import 'dart:async';

import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/widgets/message_bubble.dart';
import 'package:openflow/widgets/thinking_indicator.dart';

class MessageList extends StatefulWidget {
  const MessageList({
    required this.messages,
    super.key,
    this.onRetry,
    this.onLoadMore,
    this.onEdit,
    this.hasMore = false,
    this.isLoadingMore = false,
    this.isSending = false,
  });

  final List<ChatMessage> messages;
  final VoidCallback? onRetry;
  final VoidCallback? onLoadMore;
  final ValueChanged<String>? onEdit;
  final bool hasMore;
  final bool isLoadingMore;
  final bool isSending;

  @override
  State<MessageList> createState() => MessageListState();
}

class MessageListState extends State<MessageList> {
  final ScrollController _controller = ScrollController();
  bool _isNearBottom = true;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(covariant MessageList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.messages.isEmpty) return;
    if (widget.messages.length > oldWidget.messages.length &&
        oldWidget.messages.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => scrollToBottom());
      return;
    }
    if (_isNearBottom) {
      final oldLast =
          oldWidget.messages.isNotEmpty ? oldWidget.messages.last : null;
      final newLast = widget.messages.last;
      if (newLast.content != oldLast?.content ||
          widget.messages.length != oldWidget.messages.length) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_isNearBottom) scrollToBottom();
        });
      }
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onScroll);
    _controller.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final maxScroll = _controller.position.maxScrollExtent;
    final currentScroll = _controller.position.pixels;
    final nearBottom = currentScroll < 100;
    if (nearBottom != _isNearBottom) {
      setState(() => _isNearBottom = nearBottom);
    }

    if (maxScroll - currentScroll < 100 &&
        widget.hasMore &&
        !widget.isLoadingMore) {
      widget.onLoadMore?.call();
    }
  }

  void scrollToBottom() {
    if (!_controller.hasClients) return;
    unawaited(
      _controller.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ListView.builder(
          reverse: true,
          controller: _controller,
          padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
          itemCount: widget.messages.length +
              (widget.isSending ? 1 : 0) +
              (widget.isLoadingMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == 0 && widget.isSending) {
              return const ThinkingIndicator();
            }
            final adjustedIndex = widget.isSending ? index - 1 : index;
            if (adjustedIndex >= widget.messages.length) {
              return const Padding(
                padding: EdgeInsets.all(Spacing.md),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              );
            }
            final messageIndex = widget.messages.length - 1 - adjustedIndex;
            final message = widget.messages[messageIndex];
            final prevSame = messageIndex > 0 &&
                widget.messages[messageIndex - 1].role == message.role;
            final nextSame = messageIndex < widget.messages.length - 1 &&
                widget.messages[messageIndex + 1].role == message.role;

            final isLastAssistant =
                messageIndex == widget.messages.length - 1 &&
                    message.role == MessageRole.assistant;

            return MessageBubble(
              key: ValueKey(message.id),
              message: message,
              isFirstInGroup: !prevSame,
              isLastInGroup: !nextSame,
              isLastAssistant: isLastAssistant,
              onRetry: message.isFailed ? widget.onRetry : null,
              onEdit: message.role == MessageRole.user && widget.onEdit != null
                  ? () => widget.onEdit!(message.content)
                  : null,
            );
          },
        ),
        if (!_isNearBottom)
          Positioned(
            bottom: 16,
            right: 16,
            child: Semantics(
              label: '맨 아래로 스크롤',
              button: true,
              child: FloatingActionButton.small(
                onPressed: scrollToBottom,
                child: const Icon(Icons.keyboard_double_arrow_down),
              ),
            ),
          ),
      ],
    );
  }
}
