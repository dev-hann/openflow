import 'dart:async';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';

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
import 'package:openflow/widgets/thinking_indicator.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  final GlobalKey<MessageListState> _listKey = GlobalKey();
  Timer? _sendTimeout;
  String? _lastUserMessage;
  String? _loadedSessionId;
  late final WebSocketService _ws;
  int _totalMessages = 0;
  int _serverLoadedCount = 0;
  bool _isLoadingHistory = false;
  bool _isLoadingMore = false;
  bool _isCreatingSession = false;
  int _msgCounter = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ws = context.read<WebSocketService>();
    _connectWebSocket();
    unawaited(_loadInitialMessages());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sendTimeout?.cancel();
    _ws.onConnected = null;
    _ws.onDisconnected = null;
    _ws.onMessage = null;
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
      final result = await api.fetchMessages(sessionId, offset: offset);
      if (!mounted) return;
      final chatCubit = context.read<ChatCubit>();
      if (offset == 0) {
        _serverLoadedCount = result.messages.length;
        chatCubit.setMessages(result.messages.reversed.toList());
      } else {
        _serverLoadedCount += result.messages.length;
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
    if (_serverLoadedCount >= _totalMessages) return;
    setState(() => _isLoadingMore = true);
    try {
      await _loadMessages(sessionId, offset: _serverLoadedCount);
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
        _resetSendTimeout();
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
        _sendTimeout?.cancel();
        context.read<SessionsCubit>().setActiveSessionId(sessionId);
        chatCubit.clearMessages();
        unawaited(_loadMessages(sessionId));
      case WsAuthRequired():
      case WsAuthOk():
      case WsPong():
      case WsNotification():
      case WsUnknown():
        break;
    }
  }

  Future<String?> _ensureSession(String token) async {
    final sessionsCubit = context.read<SessionsCubit>();
    final existingId = sessionsCubit.state.activeSessionId;
    if (existingId != null) return existingId;
    if (_isCreatingSession) return null;
    _isCreatingSession = true;
    try {
      final api = createApiClient(
        context.read<AuthCubit>().state.storedAuth!.serverUrl,
        token: token,
      );
      final session = await api.createSession();
      sessionsCubit.addSession(session);
      return session.id;
    } finally {
      _isCreatingSession = false;
    }
  }

  Future<void> _sendMessage(String text) async {
    final authCubit = context.read<AuthCubit>();
    final chatCubit = context.read<ChatCubit>();
    final ws = context.read<WebSocketService>();
    final token = await authCubit.getValidToken();
    if (token == null) return;
    final sessionId = await _ensureSession(token);
    if (sessionId == null || !mounted) return;
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
    _resetSendTimeout();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _listKey.currentState?.scrollToBottom();
    });
  }

  void _resetSendTimeout() {
    _sendTimeout?.cancel();
    _sendTimeout = Timer(const Duration(seconds: 60), () {
      if (mounted) context.read<ChatCubit>().markLastMessageFailed();
    });
  }

  void _retryLastMessage() {
    final lastUserText = _lastUserMessage;
    if (lastUserText == null) return;
    context.read<ChatCubit>().removeFailedPair();
    unawaited(_sendMessage(lastUserText));
  }

  void _editMessage(String text) {
    context.read<ChatCubit>().removeFailedPair();
    unawaited(_sendMessage(text));
  }

  void _reconnect() => _connectWebSocket();

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
            return _buildChatContent(chatState);
          },
        );
      },
    );
  }

  Widget _buildChatContent(ChatState chatState) {
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
              : MessageList(
                  key: _listKey,
                  messages: chatState.messages,
                  onRetry: _retryLastMessage,
                  onEdit: _editMessage,
                  onLoadMore: _loadMoreMessages,
                  hasMore: _serverLoadedCount < _totalMessages,
                  isLoadingMore: _isLoadingHistory,
                ),
        ),
        if (chatState.isSending) const ThinkingIndicator(),
        InputBar(onSend: _sendMessage, disabled: chatState.isSending),
      ],
    );
  }
}
