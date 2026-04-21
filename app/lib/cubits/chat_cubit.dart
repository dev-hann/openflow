import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/models/protocol.dart';

class ChatState extends Equatable {
  const ChatState({this.messages = const [], this.isSending = false});
  final List<ChatMessage> messages;
  final bool isSending;

  ChatState copyWith({List<ChatMessage>? messages, bool? isSending}) {
    return ChatState(
      messages: messages ?? this.messages,
      isSending: isSending ?? this.isSending,
    );
  }

  @override
  List<Object?> get props => [messages, isSending];
}

class ChatCubit extends Cubit<ChatState> {
  ChatCubit() : super(const ChatState());

  void addMessage(ChatMessage message) {
    emit(state.copyWith(messages: [...state.messages, message]));
  }

  void appendToLastMessage(String token) {
    final messages = List<ChatMessage>.from(state.messages);
    if (messages.isEmpty) return;
    final last = messages.last;
    if (last.role != MessageRole.assistant || !last.isStreaming) return;
    messages[messages.length - 1] = last.copyWith(
      content: last.content + token,
    );
    emit(state.copyWith(messages: messages));
  }

  void finalizeLastMessage([String? content]) {
    final messages = List<ChatMessage>.from(state.messages);
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
    final messages = List<ChatMessage>.from(state.messages);
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
    final messages = List<ChatMessage>.from(state.messages);
    final originalLength = messages.length;
    while (messages.isNotEmpty) {
      final last = messages.last;
      if (last.role == MessageRole.assistant && last.isFailed) {
        messages.removeLast();
      } else if (last.role == MessageRole.user) {
        messages.removeLast();
        break;
      } else {
        break;
      }
    }
    if (messages.length != originalLength) {
      emit(state.copyWith(messages: messages));
    }
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
}
