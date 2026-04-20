import 'package:flutter/material.dart';
import '../constants/dimensions.dart';

class ChatEmptyState extends StatelessWidget {
  final String variant; // 'disconnected', 'connecting', 'empty'
  final bool isSending;
  final ValueChanged<String> onSuggestion;
  final VoidCallback onReconnect;

  static const _suggestions = [
    '오늘 날씨 어때?',
    '도움이 필요해',
    '재미있는 이야기 해줘',
  ];

  const ChatEmptyState({
    super.key,
    required this.variant,
    required this.isSending,
    required this.onSuggestion,
    required this.onReconnect,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _icon,
              size: 64,
              color: theme.colorScheme.outline,
            ),
            const SizedBox(height: Spacing.lg),
            Text(
              _title,
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: Spacing.sm),
            Text(
              _subtitle,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: Spacing.xl),
            if (variant == 'disconnected' || variant == 'connecting')
              FilledButton.tonal(
                onPressed: variant == 'connecting' ? null : onReconnect,
                child: Text(variant == 'connecting' ? '연결 중...' : '서버 연결'),
              ),
            if (variant == 'empty') ...[
              Wrap(
                spacing: Spacing.sm,
                runSpacing: Spacing.sm,
                children: _suggestions.map((s) {
                  return ActionChip(
                    label: Text(s),
                    onPressed: isSending ? null : () => onSuggestion(s),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  IconData get _icon => switch (variant) {
        'disconnected' => Icons.cloud_off,
        'connecting' => Icons.cloud_sync,
        _ => Icons.chat_bubble_outline,
      };

  String get _title => switch (variant) {
        'disconnected' => '서버에 연결되지 않았습니다',
        'connecting' => '연결 중...',
        _ => '무엇이든 물어보세요',
      };

  String get _subtitle => switch (variant) {
        'disconnected' => '서버 주소를 설정하고 페어링을 진행해주세요',
        'connecting' => '잠시만 기다려주세요',
        _ => 'AI 비서와 대화를 시작해보세요',
      };
}
