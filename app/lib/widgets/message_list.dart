import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/widgets/message_bubble.dart';

class MessageList extends StatefulWidget {

  const MessageList({
    required this.messages, required this.onScrollStateChange, super.key,
    this.onRetry,
  });
  final List<ChatMessage> messages;
  final ValueChanged<bool> onScrollStateChange;
  final VoidCallback? onRetry;

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
      itemCount: widget.messages.length,
      itemBuilder: (context, index) {
        final message = widget.messages[index];
        final prevSame = index > 0 &&
            widget.messages[index - 1].role == message.role;
        final nextSame = index < widget.messages.length - 1 &&
            widget.messages[index + 1].role == message.role;

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
