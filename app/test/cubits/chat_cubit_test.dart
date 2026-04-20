import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/cubits/chat_cubit.dart';
import 'package:openflow/models/protocol.dart';

void main() {
  group('ChatCubit', () {
    late ChatCubit cubit;

    setUp(() {
      cubit = ChatCubit();
      addTearDown(cubit.close);
    });

    blocTest<ChatCubit, ChatState>(
      'emits initial state with empty messages',
      build: () => cubit,
      verify: (cubit) {
        expect(cubit.state.messages, isEmpty);
        expect(cubit.state.isSending, false);
      },
    );

    blocTest<ChatCubit, ChatState>(
      'addMessage appends message',
      build: () => cubit,
      act: (cubit) {
        cubit.addMessage(ChatMessage(
          id: '1',
          role: MessageRole.user,
          content: 'Hello',
          timestamp: DateTime(2025),
        ),);
      },
      expect: () => [
        ChatState(messages: [
          ChatMessage(
            id: '1',
            role: MessageRole.user,
            content: 'Hello',
            timestamp: DateTime(2025),
          ),
        ],),
      ],
    );

    blocTest<ChatCubit, ChatState>(
      'appendToLastMessage appends token to streaming assistant message',
      build: () => cubit,
      seed: () => ChatState(messages: [
        ChatMessage(
          id: '1',
          role: MessageRole.assistant,
          content: 'Hello',
          isStreaming: true,
          timestamp: DateTime(2025),
        ),
      ],),
      act: (cubit) {
        cubit.appendToLastMessage(' World');
      },
      expect: () => [
        ChatState(messages: [
          ChatMessage(
            id: '1',
            role: MessageRole.assistant,
            content: 'Hello World',
            isStreaming: true,
            timestamp: DateTime(2025),
          ),
        ],),
      ],
    );

    blocTest<ChatCubit, ChatState>(
      'appendToLastMessage ignores non-streaming messages',
      build: () => cubit,
      seed: () => ChatState(messages: [
        ChatMessage(
          id: '1',
          role: MessageRole.assistant,
          content: 'Hello',
          timestamp: DateTime(2025),
        ),
      ],),
      act: (cubit) {
        cubit.appendToLastMessage(' World');
      },
      expect: () => <ChatState>[],
    );

    blocTest<ChatCubit, ChatState>(
      'finalizeLastMessage stops streaming and sending',
      build: () => cubit,
      seed: () => ChatState(
        messages: [
          ChatMessage(
            id: '1',
            role: MessageRole.assistant,
            content: 'Done',
            isStreaming: true,
            timestamp: DateTime(2025),
          ),
        ],
        isSending: true,
      ),
      act: (cubit) {
        cubit.finalizeLastMessage();
      },
      expect: () => [
        ChatState(
          messages: [
            ChatMessage(
              id: '1',
              role: MessageRole.assistant,
              content: 'Done',
              timestamp: DateTime(2025),
            ),
          ],
        ),
      ],
    );

    blocTest<ChatCubit, ChatState>(
      'markLastMessageFailed marks failed and stops sending',
      build: () => cubit,
      seed: () => ChatState(
        messages: [
          ChatMessage(
            id: '1',
            role: MessageRole.assistant,
            content: '',
            isStreaming: true,
            timestamp: DateTime(2025),
          ),
        ],
        isSending: true,
      ),
      act: (cubit) {
        cubit.markLastMessageFailed();
      },
      expect: () => [
        ChatState(
          messages: [
            ChatMessage(
              id: '1',
              role: MessageRole.assistant,
              content: '',
              isFailed: true,
              timestamp: DateTime(2025),
            ),
          ],
        ),
      ],
    );

    blocTest<ChatCubit, ChatState>(
      'removeFailedPair removes failed assistant and preceding user',
      build: () => cubit,
      seed: () => ChatState(messages: [
        ChatMessage(
          id: 'u1',
          role: MessageRole.user,
          content: 'Hello',
          timestamp: DateTime(2025),
        ),
        ChatMessage(
          id: 'a1',
          role: MessageRole.assistant,
          content: '',
          isFailed: true,
          timestamp: DateTime(2025),
        ),
      ],),
      act: (cubit) {
        cubit.removeFailedPair();
      },
      expect: () => [const ChatState()],
    );

    blocTest<ChatCubit, ChatState>(
      'clearMessages empties the list',
      build: () => cubit,
      seed: () => ChatState(messages: [
        ChatMessage(
          id: '1',
          role: MessageRole.user,
          content: 'Hello',
          timestamp: DateTime(2025),
        ),
      ],),
      act: (cubit) {
        cubit.clearMessages();
      },
      expect: () => [const ChatState()],
    );

    blocTest<ChatCubit, ChatState>(
      'setSending updates isSending',
      build: () => cubit,
      act: (cubit) {
        cubit.setSending(true);
      },
      expect: () => [const ChatState(isSending: true)],
    );
  });
}
