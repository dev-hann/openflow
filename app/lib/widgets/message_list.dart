import 'dart:async';

import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/widgets/message_bubble.dart';

class MessageList extends StatefulWidget {
  const MessageList({
    required this.messages,
    super.key,
    this.onRetry,
    this.onLoadMore,
    this.onEdit,
    this.hasMore = false,
    this.isLoadingMore = false,
  });

  final List<ChatMessage> messages;
  final VoidCallback? onRetry;
  final VoidCallback? onLoadMore;
  final ValueChanged<String>? onEdit;
  final bool hasMore;
  final bool isLoadingMore;

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
    final nearBottom = maxScroll - currentScroll < 100;
    if (nearBottom != _isNearBottom) {
      setState(() => _isNearBottom = nearBottom);
    }

    if (currentScroll < 100 && widget.hasMore && !widget.isLoadingMore) {
      widget.onLoadMore?.call();
    }
  }

  void scrollToBottom() {
    if (!_controller.hasClients) return;
    unawaited(
      _controller.animateTo(
        _controller.position.maxScrollExtent,
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
          controller: _controller,
          padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
          itemCount: widget.messages.length + (widget.isLoadingMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == 0 && widget.isLoadingMore) {
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
            final adjustedIndex = widget.isLoadingMore ? index - 1 : index;
            final message = widget.messages[adjustedIndex];
            final prevSame = adjustedIndex > 0 &&
                widget.messages[adjustedIndex - 1].role == message.role;
            final nextSame = adjustedIndex < widget.messages.length - 1 &&
                widget.messages[adjustedIndex + 1].role == message.role;

            final isLastAssistant =
                adjustedIndex == widget.messages.length - 1 &&
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
