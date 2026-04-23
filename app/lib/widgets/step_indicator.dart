import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class StepIndicator extends StatelessWidget {
  const StepIndicator({
    required this.currentIndex,
    this.totalSteps = 3,
    super.key,
  });

  final int currentIndex;
  final int totalSteps;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        totalSteps,
        (i) => Container(
          width: i == currentIndex ? 24 : 8,
          height: 8,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: i == currentIndex ? colorScheme.primary : colorScheme.muted,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ),
    );
  }
}
