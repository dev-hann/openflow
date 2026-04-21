import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/widgets/voice_input_button.dart';

class InputBar extends StatefulWidget {
  const InputBar({required this.onSend, super.key, this.disabled = false});
  final ValueChanged<String> onSend;
  final bool disabled;

  @override
  State<InputBar> createState() => _InputBarState();
}

class _InputBarState extends State<InputBar> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isEmpty || widget.disabled) return;
    widget.onSend(text);
    _controller.clear();
  }

  void _handleVoiceResult(String text) {
    if (text.isEmpty) return;
    _controller.text = text;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canSend = _controller.text.trim().isNotEmpty && !widget.disabled;

    return Container(
      padding: EdgeInsets.only(
        left: Spacing.sm,
        right: Spacing.sm,
        top: Spacing.xs,
        bottom: Spacing.sm + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(
          top: BorderSide(
            color: theme.colorScheme.outlineVariant,
            width: 0.5,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Flexible(
              child: _TextFieldContainer(
                controller: _controller,
                focusNode: _focusNode,
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _handleSend(),
                enabled: !widget.disabled,
                theme: theme,
              ),
            ),
            VoiceInputButton(
              onResult: _handleVoiceResult,
              enabled: !widget.disabled,
            ),
            _AnimatedSendButton(
              canSend: canSend,
              onPressed: _handleSend,
              theme: theme,
            ),
          ],
        ),
      ),
    );
  }
}

class _TextFieldContainer extends StatelessWidget {
  const _TextFieldContainer({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onSubmitted,
    required this.enabled,
    required this.theme,
  });
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final bool enabled;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxHeight: 120),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        maxLines: null,
        textInputAction: TextInputAction.send,
        onSubmitted: onSubmitted,
        enabled: enabled,
        decoration: const InputDecoration(
          hintText: '무엇이든 물어보세요...',
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(
            horizontal: Spacing.md,
            vertical: 12,
          ),
        ),
      ),
    );
  }
}

class _AnimatedSendButton extends StatelessWidget {
  const _AnimatedSendButton({
    required this.canSend,
    required this.onPressed,
    required this.theme,
  });
  final bool canSend;
  final VoidCallback onPressed;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      child: IconButton.filled(
        onPressed: canSend ? onPressed : null,
        icon: const Icon(Icons.send, size: 20),
        style: IconButton.styleFrom(
          backgroundColor:
              canSend ? theme.colorScheme.primary : Colors.transparent,
          foregroundColor: canSend
              ? theme.colorScheme.onPrimary
              : theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
