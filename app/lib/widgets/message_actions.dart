import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:openflow/models/protocol.dart';

class MessageActions extends StatefulWidget {
  const MessageActions({
    required this.message,
    super.key,
    this.isLastAssistant = false,
    this.onRegenerate,
    this.onEdit,
  });

  final ChatMessage message;
  final bool isLastAssistant;
  final VoidCallback? onRegenerate;
  final VoidCallback? onEdit;

  @override
  State<MessageActions> createState() => _MessageActionsState();
}

class _MessageActionsState extends State<MessageActions> {
  bool _liked = false;
  bool _disliked = false;

  bool get _isUser => widget.message.role == MessageRole.user;
  bool get _isAssistant => widget.message.role == MessageRole.assistant;

  void _handleCopy() {
    Clipboard.setData(ClipboardData(text: widget.message.content));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('복사됨'),
        duration: Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _handleLike() {
    setState(() {
      _liked = !_liked;
      if (_liked) _disliked = false;
    });
  }

  void _handleDislike() {
    setState(() {
      _disliked = !_disliked;
      if (_disliked) _liked = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final iconColor = theme.colorScheme.onSurfaceVariant;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _ActionButton(
          icon: Icons.copy_outlined,
          tooltip: '복사',
          color: iconColor,
          onPressed: _handleCopy,
        ),
        if (_isUser && widget.onEdit != null)
          _ActionButton(
            icon: Icons.edit_outlined,
            tooltip: '편집',
            color: iconColor,
            onPressed: widget.onEdit,
          ),
        if (_isAssistant && widget.isLastAssistant && widget.onRegenerate != null)
          _ActionButton(
            icon: Icons.refresh,
            tooltip: '재생성',
            color: iconColor,
            onPressed: widget.onRegenerate,
          ),
        if (_isAssistant) ...[
          _ActionButton(
            icon: _liked ? Icons.thumb_up : Icons.thumb_up_outlined,
            tooltip: '좋아요',
            color: _liked ? theme.colorScheme.primary : iconColor,
            onPressed: _handleLike,
          ),
          _ActionButton(
            icon: _disliked ? Icons.thumb_down : Icons.thumb_down_outlined,
            tooltip: '싫어요',
            color: _disliked ? theme.colorScheme.error : iconColor,
            onPressed: _handleDislike,
          ),
        ],
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(icon, size: 16),
      tooltip: tooltip,
      color: color,
      onPressed: onPressed,
      visualDensity: VisualDensity.compact,
      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      padding: EdgeInsets.zero,
      splashRadius: 16,
    );
  }
}
