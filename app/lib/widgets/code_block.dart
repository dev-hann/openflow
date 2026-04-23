import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:openflow/config/design_tokens.dart';

class CodeBlock extends StatelessWidget {
  const CodeBlock({
    required this.code,
    super.key,
    this.language,
  });

  final String code;
  final String? language;

  static const _backgroundColor = Color(0xFF1E1E2E);
  static const _textColor = Color(0xFFCDD6F4);
  static const _labelColor = Color(0xFFA6ADC8);

  void _handleCopy(BuildContext context) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('코드가 복사됨'),
        duration: Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = (language?.trim().isNotEmpty ?? false)
        ? language!.trim().toUpperCase()
        : null;

    return Container(
      decoration: BoxDecoration(
        color: _backgroundColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
            child: Row(
              children: [
                if (lang != null)
                  Text(
                    lang,
                    style: const TextStyle(
                      color: _labelColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.copy_outlined, size: 14),
                  color: _labelColor,
                  tooltip: '복사',
                  onPressed: () => _handleCopy(context),
                  visualDensity: VisualDensity.compact,
                  constraints:
                      const BoxConstraints(minWidth: 28, minHeight: 28),
                  padding: EdgeInsets.zero,
                  splashRadius: 14,
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFF313244)),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(12),
            child: Text(
              code,
              style: const TextStyle(
                color: _textColor,
                fontSize: 13,
                fontFamily: 'RobotoMono',
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
