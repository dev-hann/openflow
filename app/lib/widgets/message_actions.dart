import 'dart:async';

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

class _MessageActionsState extends State<MessageActions>
    with TickerProviderStateMixin {
  bool _liked = false;
  bool _disliked = false;
  bool _copied = false;
  bool _isRegenerating = false;

  late final AnimationController _likeController;
  late final AnimationController _dislikeController;
  late final AnimationController _regenerateController;

  bool get _isUser => widget.message.role == MessageRole.user;
  bool get _isAssistant => widget.message.role == MessageRole.assistant;

  @override
  void initState() {
    super.initState();
    _likeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
      lowerBound: 1.0,
      upperBound: 1.3,
    );
    _dislikeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
      lowerBound: 1.0,
      upperBound: 1.3,
    );
    _regenerateController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
  }

  @override
  void dispose() {
    _likeController.dispose();
    _dislikeController.dispose();
    _regenerateController.dispose();
    super.dispose();
  }

  void _handleCopy() {
    Clipboard.setData(ClipboardData(text: widget.message.content));
    setState(() => _copied = true);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('복사됨'),
        duration: Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  void _handleLike() {
    setState(() {
      _liked = !_liked;
      if (_liked) _disliked = false;
    });
    _likeController.forward().then((_) => _likeController.reverse());
  }

  void _handleDislike() {
    setState(() {
      _disliked = !_disliked;
      if (_disliked) _liked = false;
    });
    _dislikeController.forward().then((_) => _dislikeController.reverse());
  }

  Future<void> _handleRegenerate() async {
    if (_isRegenerating) return;
    setState(() => _isRegenerating = true);
    await _regenerateController.forward();
    widget.onRegenerate?.call();
    if (mounted) {
      _regenerateController.reset();
      setState(() => _isRegenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final iconColor = theme.colorScheme.onSurfaceVariant;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _ActionButton(
          icon: _copied ? Icons.check : Icons.copy_outlined,
          tooltip: _copied ? '복사됨' : '복사',
          color: _copied ? theme.colorScheme.primary : iconColor,
          onPressed: _handleCopy,
        ),
        if (_isUser && widget.onEdit != null)
          _ActionButton(
            icon: Icons.edit_outlined,
            tooltip: '편집',
            color: iconColor,
            onPressed: widget.onEdit!,
          ),
        if (_isAssistant && widget.isLastAssistant && widget.onRegenerate != null)
          _ActionButton(
            icon: Icons.refresh,
            tooltip: '재생성',
            color: iconColor,
            onPressed: _handleRegenerate,
            rotationController: _regenerateController,
          ),
        if (_isAssistant)
          ScaleTransition(
            scale: _likeController,
            child: _ActionButton(
              icon: _liked ? Icons.thumb_up : Icons.thumb_up_outlined,
              tooltip: '좋아요',
              color: _liked ? theme.colorScheme.primary : iconColor,
              onPressed: _handleLike,
            ),
          ),
        if (_isAssistant)
          ScaleTransition(
            scale: _dislikeController,
            child: _ActionButton(
              icon: _disliked ? Icons.thumb_down : Icons.thumb_down_outlined,
              tooltip: '싫어요',
              color: _disliked ? theme.colorScheme.error : iconColor,
              onPressed: _handleDislike,
            ),
          ),
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
    this.rotationController,
  });

  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onPressed;
  final AnimationController? rotationController;

  @override
  Widget build(BuildContext context) {
    Widget iconWidget = Icon(icon, size: 16);

    if (rotationController != null) {
      iconWidget = RotationTransition(
        turns: rotationController!,
        child: iconWidget,
      );
    }

    return IconButton(
      icon: iconWidget,
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
