import 'package:flutter/widgets.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class ThinkingIndicator extends StatelessWidget {
  const ThinkingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;

    return ColoredBox(
      color: colorScheme.background,
      child: ShadAccordion<String>(
        children: [
          ShadAccordionItem(
            value: 'thinking',
            title: Row(
              children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CustomPaint(
                    painter: _ThinkingSpinnerPainter(
                      color: colorScheme.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '생각 중...',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: colorScheme.mutedForeground,
                  ),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.only(
                left: AppSpacing.md,
                right: AppSpacing.md,
                bottom: AppSpacing.sm,
              ),
              child: Text(
                'AI가 응답을 생성하고 있습니다...',
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.mutedForeground,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ThinkingSpinnerPainter extends CustomPainter {
  _ThinkingSpinnerPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - 2) / 2;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -1.5708,
      4,
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _ThinkingSpinnerPainter old) =>
      color != old.color;
}
