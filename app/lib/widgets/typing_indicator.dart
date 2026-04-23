import 'dart:math';

import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class TypingIndicator extends StatelessWidget {
  const TypingIndicator({required this.color, super.key});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        return Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            )
            .animate(onPlay: (c) => c.repeat())
            .custom(
              duration: 400.ms,
              delay: (i * 133).ms,
              builder: (context, value, child) {
                final scale = 0.5 + 0.5 * sin(value * pi);
                final opacity = 0.4 + 0.6 * sin(value * pi);
                return Opacity(
                  opacity: opacity,
                  child: Transform.scale(scale: scale, child: child),
                );
              },
            );
      }),
    );
  }
}
