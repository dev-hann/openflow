import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:openflow/models/protocol.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

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
  final ValueChanged<String>? onEdit;

  @override
  State<MessageActions> createState() => _MessageActionsState();
}

class _MessageActionsState extends State<MessageActions> {
  bool _liked = false;
  bool _disliked = false;
  bool _copied = false;
  bool _isRegenerating = false;
  bool _likeAnimating = false;
  bool _dislikeAnimating = false;

  bool get _isUser => widget.message.role == MessageRole.user;
  bool get _isAssistant => widget.message.role == MessageRole.assistant;

  void _handleCopy() {
    Clipboard.setData(ClipboardData(text: widget.message.content));
    setState(() => _copied = true);
    ShadToaster.of(
      context,
    ).show(const ShadToast(title: Text('복사됨'), duration: Duration(seconds: 1)));
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  void _handleLike() {
    setState(() {
      _liked = !_liked;
      if (_liked) _disliked = false;
      _likeAnimating = true;
    });
    Future<void>.delayed(300.ms, () {
      if (mounted) setState(() => _likeAnimating = false);
    });
  }

  void _handleDislike() {
    setState(() {
      _disliked = !_disliked;
      if (_disliked) _liked = false;
      _dislikeAnimating = true;
    });
    Future<void>.delayed(300.ms, () {
      if (mounted) setState(() => _dislikeAnimating = false);
    });
  }

  Future<void> _handleRegenerate() async {
    if (_isRegenerating) return;
    setState(() => _isRegenerating = true);
    await Future<void>.delayed(300.ms);
    widget.onRegenerate?.call();
    if (mounted) {
      setState(() => _isRegenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    final iconColor = colorScheme.mutedForeground;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _ActionButton(
          icon: _copied ? LucideIcons.check : LucideIcons.copy,
          color: _copied ? colorScheme.primary : iconColor,
          onPressed: _handleCopy,
        ),
        if (_isUser && widget.onEdit != null)
          _ActionButton(
            icon: LucideIcons.pencil,
            color: iconColor,
            onPressed: () => widget.onEdit!(widget.message.content),
          ),
        if (_isAssistant &&
            widget.isLastAssistant &&
            widget.onRegenerate != null)
          _ActionButton(
                icon: LucideIcons.refreshCw,
                color: iconColor,
                onPressed: _handleRegenerate,
              )
              .animate(target: _isRegenerating ? 1.0 : 0.0)
              .rotate(duration: 300.ms),
        if (_isAssistant)
          _ActionButton(
                icon: _liked ? LucideIcons.thumbsUp : LucideIcons.thumbsUp,
                color: _liked ? colorScheme.primary : iconColor,
                onPressed: _handleLike,
              )
              .animate(target: _likeAnimating ? 1.0 : 0.0)
              .scale(
                begin: const Offset(1, 1),
                end: const Offset(1.3, 1.3),
                duration: 150.ms,
              ),
        if (_isAssistant)
          _ActionButton(
                icon: _disliked
                    ? LucideIcons.thumbsDown
                    : LucideIcons.thumbsDown,
                color: _disliked ? colorScheme.destructive : iconColor,
                onPressed: _handleDislike,
              )
              .animate(target: _dislikeAnimating ? 1.0 : 0.0)
              .scale(
                begin: const Offset(1, 1),
                end: const Offset(1.3, 1.3),
                duration: 150.ms,
              ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.color,
    required this.onPressed,
  });

  final IconData icon;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 36,
        height: 36,
        child: Center(child: Icon(icon, size: 16, color: color)),
      ),
    );
  }
}
