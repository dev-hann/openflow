import 'dart:async';

import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/widgets/message_bubble.dart';

class MessageList extends StatefulWidget {
  const MessageList({
    required this.messages,
    required this.onScrollStateChange,
    super.key,
    this.onRetry,
    this.onLoadMore,
    this.hasMore = false,
    this.isLoadingMore = false,
  });
  final List<ChatMessage> messages;
  final ValueChanged<bool> onScrollStateChange;
  final VoidCallback? onRetry;
  final VoidCallback? onLoadMore;
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
    if (widget.messages.length > oldWidget.messages.length &&
        oldWidget.messages.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => scrollToBottom());
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
      _isNearBottom = nearBottom;
      widget.onScrollStateChange(!_isNearBottom);
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
    return ListView.builder(
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
        final prevSame =
            adjustedIndex > 0 && widget.messages[adjustedIndex - 1].role == message.role;
        final nextSame = adjustedIndex < widget.messages.length - 1 &&
            widget.messages[adjustedIndex + 1].role == message.role;

        return MessageBubble(
          message: message,
          isFirstInGroup: !prevSame,
          isLastInGroup: !nextSame,
          onRetry: message.isFailed ? widget.onRetry : null,
        );
      },
    );
  }
}
