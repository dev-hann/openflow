import 'dart:async';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/chat_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/websocket_service.dart';
import 'package:openflow/widgets/chat_empty_state.dart'
    show ChatEmptyState, EmptyStateVariant;
import 'package:openflow/widgets/input_bar.dart';
import 'package:openflow/widgets/message_list.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  final GlobalKey<MessageListState> _listKey = GlobalKey();
  bool _scrolledUp = false;
  Timer? _sendTimeout;
  String? _lastUserMessage;
  String? _loadedSessionId;
  int _totalMessages = 0;
  bool _isLoadingHistory = false;
  bool _isLoadingMore = false;
  int _msgCounter = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _connectWebSocket();
    unawaited(_loadInitialMessages());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sendTimeout?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      final ws = context.read<WebSocketService>();
      if (ws.connectionState != WsConnectionState.connected) {
        _connectWebSocket();
      }
    }
  }

  void _connectWebSocket() {
    final authState = context.read<AuthCubit>().state;
    if (authState.storedAuth == null) return;

    final ws = context.read<WebSocketService>();

    ws.onConnected = () {
      if (mounted) context.read<AuthCubit>().setConnected(true);
    };
    ws.onDisconnected = () {
      if (mounted) context.read<AuthCubit>().setConnected(false);
    };
    ws.onMessage = _handleWsMessage;

    ws.connect(
      authState.storedAuth!.serverUrl,
      authState.storedAuth!.accessToken,
    );
  }

  Future<void> _loadInitialMessages() async {
    final sessionId = context.read<SessionsCubit>().state.activeSessionId;
    if (sessionId == null) return;
    await _loadMessages(sessionId);
  }

  Future<void> _loadMessages(String sessionId, {int offset = 0}) async {
    if (_isLoadingHistory) return;
    final authCubit = context.read<AuthCubit>();
    final token = await authCubit.getValidToken();
    if (token == null || !mounted) return;

    setState(() => _isLoadingHistory = true);

    try {
      final api = createApiClient(
        authCubit.state.storedAuth!.serverUrl,
        token: token,
      );
      final result = await api.fetchMessages(
        sessionId,
        offset: offset,
      );
      if (!mounted) return;

      final chatCubit = context.read<ChatCubit>();
      if (offset == 0) {
        chatCubit.setMessages(result.messages.reversed.toList());
      } else {
        chatCubit.prependMessages(result.messages.reversed.toList());
      }
      _loadedSessionId = sessionId;
      _totalMessages = result.total;
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('메시지를 불러올 수 없습니다.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoadingHistory = false);
    }
  }

  Future<void> _loadMoreMessages() async {
    if (_isLoadingMore) return;
    final sessionId = _loadedSessionId;
    if (sessionId == null) return;
    final currentCount = context.read<ChatCubit>().state.messages.length;
    if (currentCount >= _totalMessages) return;
    setState(() => _isLoadingMore = true);
    try {
      await _loadMessages(sessionId, offset: currentCount);
    } finally {
      if (mounted) setState(() => _isLoadingMore = false);
    }
  }

  void _handleWsMessage(WsServerMessage message) {
    if (!mounted) return;
    final chatCubit = context.read<ChatCubit>();

    switch (message) {
      case WsTokenChunk(:final content):
        chatCubit.appendToLastMessage(content);
      case WsResponse(:final content):
        chatCubit.finalizeLastMessage(content);
        _sendTimeout?.cancel();
      case WsError(:final message):
        chatCubit.markLastMessageFailed();
        _sendTimeout?.cancel();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('오류: $message')),
        );
      case WsSessionSwitched(:final sessionId):
        context.read<SessionsCubit>().setActiveSessionId(sessionId);
        chatCubit.clearMessages();
        unawaited(_loadMessages(sessionId));
      case WsAuthRequired():
      case WsAuthOk():
      case WsPong():
      case WsUnknown():
        break;
    }
  }

  Future<void> _sendMessage(String text) async {
    final authCubit = context.read<AuthCubit>();
    final chatCubit = context.read<ChatCubit>();
    final sessionsCubit = context.read<SessionsCubit>();
    final ws = context.read<WebSocketService>();

    final token = await authCubit.getValidToken();
    if (token == null) return;

    var sessionId = sessionsCubit.state.activeSessionId;

    if (sessionId == null) {
      try {
        final api = createApiClient(
          authCubit.state.storedAuth!.serverUrl,
          token: token,
        );
        final session = await api.createSession();
        sessionsCubit.addSession(session);
        sessionId = session.id;
      } on Object catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('세션 생성 실패: $e')),
          );
        }
        return;
      }
    }

    final userMsg = ChatMessage(
      id: _generateId(),
      role: MessageRole.user,
      content: text,
      timestamp: DateTime.now(),
    );
    final assistantMsg = ChatMessage(
      id: _generateId(),
      role: MessageRole.assistant,
      content: '',
      isStreaming: true,
      timestamp: DateTime.now(),
    );

    chatCubit.addMessage(userMsg);
    chatCubit.addMessage(assistantMsg);
    chatCubit.setSending(true);

    _lastUserMessage = text;
    ws.send(WsChatMsg(sessionId: sessionId, content: text));

    _sendTimeout?.cancel();
    _sendTimeout = Timer(const Duration(seconds: 60), () {
      if (mounted) chatCubit.markLastMessageFailed();
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _listKey.currentState?.scrollToBottom();
    });
  }

  void _retryLastMessage() {
    final chatCubit = context.read<ChatCubit>();
    final lastUserText = _lastUserMessage;
    if (lastUserText == null) return;
    chatCubit.removeFailedPair();
    unawaited(_sendMessage(lastUserText));
  }

  void _editMessage(String text) {
    final chatCubit = context.read<ChatCubit>();
    chatCubit.removeFailedPair();
    unawaited(_sendMessage(text));
  }

  void _reconnect() {
    _connectWebSocket();
  }

  String _generateId() =>
      '_msg_${DateTime.now().millisecondsSinceEpoch}_${++_msgCounter}';

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, authState) {
        return BlocBuilder<ChatCubit, ChatState>(
          builder: (context, chatState) {
            if (authState.storedAuth == null) {
              return ChatEmptyState(
                variant: EmptyStateVariant.disconnected,
                isSending: false,
                onSuggestion: _sendMessage,
                onReconnect: _reconnect,
              );
            }

            if (!authState.isConnected) {
              return ChatEmptyState(
                variant: EmptyStateVariant.connecting,
                isSending: false,
                onSuggestion: _sendMessage,
                onReconnect: _reconnect,
              );
            }

            return _buildChatContent(context, chatState);
          },
        );
      },
    );
  }

  Widget _buildChatContent(BuildContext context, ChatState chatState) {
    return Column(
      children: [
        Expanded(
          child: chatState.messages.isEmpty
              ? ChatEmptyState(
                  variant: EmptyStateVariant.empty,
                  isSending: chatState.isSending,
                  onSuggestion: _sendMessage,
                  onReconnect: _reconnect,
                )
              : Stack(
                  children: [
                    MessageList(
                      key: _listKey,
                      messages: chatState.messages,
                      onScrollStateChange: (scrolledUp) =>
                          setState(() => _scrolledUp = scrolledUp),
                      onRetry: _retryLastMessage,
                      onEdit: _editMessage,
                      onLoadMore: _loadMoreMessages,
                      hasMore: chatState.messages.length < _totalMessages,
                      isLoadingMore: _isLoadingHistory,
                    ),
                    if (_scrolledUp)
                      Positioned(
                        bottom: 16,
                        right: 16,
                        child: Semantics(
                          label: '맨 아래로 스크롤',
                          button: true,
                          child: FloatingActionButton.small(
                            onPressed: () =>
                                _listKey.currentState?.scrollToBottom(),
                            child: const Icon(
                              Icons.keyboard_double_arrow_down,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
        ),
        if (chatState.isSending) _buildThinkingIndicator(context),
        InputBar(
          onSend: _sendMessage,
          disabled: chatState.isSending,
        ),
      ],
    );
  }

  Widget _buildThinkingIndicator(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      color: theme.colorScheme.surface,
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: Spacing.md),
          childrenPadding: const EdgeInsets.only(
            left: Spacing.md,
            right: Spacing.md,
            bottom: Spacing.sm,
          ),
          leading: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: theme.colorScheme.primary,
            ),
          ),
          title: Text(
            '생각 중...',
            style: theme.textTheme.labelMedium,
          ),
          children: [
            Text(
              'AI가 응답을 생성하고 있습니다...',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
