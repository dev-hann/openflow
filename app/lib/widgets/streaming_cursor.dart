import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class StreamingCursor extends StatelessWidget {
  const StreamingCursor({required this.color, super.key});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
          '▌',
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.bold,
            fontSize: 15,
          ),
        )
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .fadeIn(duration: 1000.ms, curve: Curves.easeInOut);
  }
}
