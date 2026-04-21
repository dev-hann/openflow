import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/models/protocol.dart';

class ChatState extends Equatable {
  const ChatState({
    this.messages = const [],
    this.isSending = false,
    this.errorMessage,
  });
  final List<ChatMessage> messages;
  final bool isSending;
  final String? errorMessage;

  ChatState copyWith({
    List<ChatMessage>? messages,
    bool? isSending,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isSending: isSending ?? this.isSending,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [messages, isSending, errorMessage];
}

class ChatCubit extends Cubit<ChatState> {
  ChatCubit() : super(const ChatState());

  void addMessage(ChatMessage message) {
    emit(state.copyWith(messages: [...state.messages, message]));
  }

  void appendToLastMessage(String token) {
    final messages = List<ChatMessage>.of(state.messages);
    if (messages.isEmpty) return;
    final last = messages.last;
    if (last.role != MessageRole.assistant || !last.isStreaming) return;
    messages[messages.length - 1] = last.copyWith(
      content: last.content + token,
    );
    emit(state.copyWith(messages: messages));
  }

  void finalizeLastMessage([String? content]) {
    final messages = List<ChatMessage>.of(state.messages);
    if (messages.isEmpty) return;
    final last = messages.last;
    if (last.role != MessageRole.assistant) return;
    messages[messages.length - 1] = last.copyWith(
      content: content != null && content.isNotEmpty && last.content.isEmpty
          ? content
          : null,
      isStreaming: false,
    );
    emit(state.copyWith(messages: messages, isSending: false));
  }

  void markLastMessageFailed() {
    final messages = List<ChatMessage>.of(state.messages);
    if (messages.isEmpty) return;
    final last = messages.last;
    if (last.role != MessageRole.assistant) return;
    messages[messages.length - 1] = last.copyWith(
      isStreaming: false,
      isFailed: true,
    );
    emit(state.copyWith(messages: messages, isSending: false));
  }

  void removeFailedPair() {
    if (state.messages.isEmpty) return;
    final messages = List<ChatMessage>.of(state.messages);
    int lastFailedIdx = -1;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].isFailed) {
        lastFailedIdx = i;
        break;
      }
    }
    if (lastFailedIdx == -1) return;
    if (lastFailedIdx > 0) {
      messages.removeRange(lastFailedIdx - 1, lastFailedIdx + 1);
    } else {
      messages.removeAt(0);
    }
    emit(state.copyWith(messages: messages));
  }

  void clearMessages() {
    emit(state.copyWith(messages: []));
  }

  void setMessages(List<ChatMessage> messages) {
    emit(state.copyWith(messages: messages));
  }

  void prependMessages(List<ChatMessage> olderMessages) {
    emit(state.copyWith(messages: [...olderMessages, ...state.messages]));
  }

  void setSending(bool sending) {
    emit(state.copyWith(isSending: sending));
  }

  void setError(String msg) {
    emit(state.copyWith(errorMessage: msg));
  }

  void clearError() {
    emit(state.copyWith(clearError: true));
  }
}
