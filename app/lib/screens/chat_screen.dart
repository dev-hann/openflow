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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _connectWebSocket();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sendTimeout?.cancel();
    super.dispose();
  }

  void _connectWebSocket() {
    final authState = context.read<AuthCubit>().state;
    if (authState.storedAuth == null) return;

    final ws = context.read<WebSocketService>();
    ws.connect(
      authState.storedAuth!.serverUrl,
      authState.storedAuth!.accessToken,
    );

    ws.onConnected = () {
      if (mounted) context.read<AuthCubit>().setConnected(true);
    };
    ws.onDisconnected = () {
      if (mounted) context.read<AuthCubit>().setConnected(false);
    };
    ws.onMessage = _handleWsMessage;
  }

  void _handleWsMessage(WsServerMessage message) {
    if (!mounted) return;
    final chatCubit = context.read<ChatCubit>();

    switch (message) {
      case WsTokenChunk(:final content):
        chatCubit.appendToLastMessage(content);
      case WsResponse():
        chatCubit.finalizeLastMessage();
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
      default:
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
        final api = createApiClient(authCubit.state.storedAuth!.serverUrl);
        final session = await api.createSession(token);
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

  void _reconnect() {
    _connectWebSocket();
  }

  String _generateId() => DateTime.now().microsecondsSinceEpoch.toString();

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
                            ),
                            if (_scrolledUp)
                              Positioned(
                                bottom: 16,
                                right: 16,
                                child: FloatingActionButton.small(
                                  onPressed: () =>
                                      _listKey.currentState?.scrollToBottom(),
                                  child: const Icon(
                                    Icons.keyboard_double_arrow_down,
                                  ),
                                ),
                              ),
                          ],
                        ),
                ),
                if (chatState.isSending)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: Spacing.md,
                      vertical: Spacing.xs + 2,
                    ),
                    color: Theme.of(context).colorScheme.surface,
                    child: Row(
                      children: [
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '생각 중...',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ],
                    ),
                  ),
                InputBar(
                  onSend: _sendMessage,
                  disabled: chatState.isSending,
                ),
              ],
            );
          },
        );
      },
    );
  }
}
