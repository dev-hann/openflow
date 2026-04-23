import 'package:flutter/material.dart' show Colors, TextInputAction;
import 'package:flutter/widgets.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/widgets/voice_input_button.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

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
    final colorScheme = ShadTheme.of(context).colorScheme;
    final canSend = _controller.text.trim().isNotEmpty && !widget.disabled;

    return Container(
      padding: EdgeInsets.only(
        left: AppSpacing.sm,
        right: AppSpacing.sm,
        top: AppSpacing.xs,
        bottom: AppSpacing.sm + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: colorScheme.background,
        border: Border(top: BorderSide(color: colorScheme.border, width: 0.5)),
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
              ),
            ),
            VoiceInputButton(
              onResult: _handleVoiceResult,
              enabled: !widget.disabled,
            ),
            _AnimatedSendButton(canSend: canSend, onPressed: _handleSend),
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
  });
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Container(
      constraints: const BoxConstraints(maxHeight: 120),
      decoration: BoxDecoration(
        color: colorScheme.muted,
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: ShadInput(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        maxLines: null,
        textInputAction: TextInputAction.send,
        onSubmitted: onSubmitted,
        enabled: enabled,
        placeholder: const Text('무엇이든 물어보세요...'),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 12,
        ),
        decoration: const ShadDecoration(border: ShadBorder.none),
      ),
    );
  }
}

class _AnimatedSendButton extends StatelessWidget {
  const _AnimatedSendButton({required this.canSend, required this.onPressed});
  final bool canSend;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      child: ShadIconButton(
        onPressed: canSend ? onPressed : null,
        icon: Icon(
          LucideIcons.send,
          size: 18,
          color: canSend
              ? colorScheme.primaryForeground
              : colorScheme.mutedForeground,
        ),
        backgroundColor: canSend ? colorScheme.primary : Colors.transparent,
      ),
    );
  }
}
