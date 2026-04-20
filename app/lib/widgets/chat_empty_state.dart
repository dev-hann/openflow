import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';

enum EmptyStateVariant { disconnected, connecting, empty }

class ChatEmptyState extends StatelessWidget {
  const ChatEmptyState({
    required this.variant,
    required this.isSending,
    required this.onSuggestion,
    required this.onReconnect,
    super.key,
  });
  final EmptyStateVariant variant;
  final bool isSending;
  final ValueChanged<String> onSuggestion;
  final VoidCallback onReconnect;

  static const _suggestions = [
    '오늘 날씨 어때?',
    '도움이 필요해',
    '재미있는 이야기 해줘',
  ];

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
            if (variant == EmptyStateVariant.disconnected ||
                variant == EmptyStateVariant.connecting)
              FilledButton.tonal(
                onPressed: variant == EmptyStateVariant.connecting
                    ? null
                    : onReconnect,
                child: Text(
                  variant == EmptyStateVariant.connecting ? '연결 중...' : '서버 연결',
                ),
              ),
            if (variant == EmptyStateVariant.empty) ...[
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
        EmptyStateVariant.disconnected => Icons.cloud_off,
        EmptyStateVariant.connecting => Icons.cloud_sync,
        EmptyStateVariant.empty => Icons.chat_bubble_outline,
      };

  String get _title => switch (variant) {
        EmptyStateVariant.disconnected => '서버에 연결되지 않았습니다',
        EmptyStateVariant.connecting => '연결 중...',
        EmptyStateVariant.empty => '무엇이든 물어보세요',
      };

  String get _subtitle => switch (variant) {
        EmptyStateVariant.disconnected => '서버 주소를 설정하고 페어링을 진행해주세요',
        EmptyStateVariant.connecting => '잠시만 기다려주세요',
        EmptyStateVariant.empty => 'AI 비서와 대화를 시작해보세요',
      };
}
