import 'package:flutter/material.dart';

class PinInput extends StatelessWidget {
  const PinInput({
    required this.controller,
    required this.focusNode,
    this.onChanged,
    super.key,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildPinBoxes(context),
        Offstage(child: _buildPinTextField()),
      ],
    );
  }

  Widget _buildPinBoxes(BuildContext context) {
    return GestureDetector(
      onTap: focusNode.requestFocus,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(6, (i) {
          return Container(
            width: 44,
            height: 52,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              border: Border.all(
                color: Theme.of(context).colorScheme.outline,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Text(
              i < controller.text.length ? controller.text[i] : '',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          );
        }),
      ),
    );
  }

  Widget _buildPinTextField() {
    return SizedBox(
      width: 200,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        keyboardType: TextInputType.number,
        maxLength: 6,
        autofocus: true,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 24, letterSpacing: 8),
        decoration: const InputDecoration(
          counterText: '',
          border: InputBorder.none,
        ),
        onChanged: onChanged ?? (_) {},
        onSubmitted: (_) {},
      ),
    );
  }
}
