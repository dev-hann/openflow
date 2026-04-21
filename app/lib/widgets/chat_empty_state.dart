import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';

enum EmptyStateVariant { disconnected, connecting, empty }

class _SuggestionCard {
  const _SuggestionCard({
    required this.icon,
    required this.title,
    required this.prompt,
  });

  final IconData icon;
  final String title;
  final String prompt;
}

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
    _SuggestionCard(
      icon: Icons.edit_note,
      title: '글쓰기 도움',
      prompt: '다음 주제로 글을 작성해줘: ',
    ),
    _SuggestionCard(
      icon: Icons.search,
      title: '검색 도움',
      prompt: '다음에 대해 검색해줘: ',
    ),
    _SuggestionCard(
      icon: Icons.lightbulb_outline,
      title: '아이디어 브레인스토밍',
      prompt: '아이디어를 브레인스토밍해줘: ',
    ),
    _SuggestionCard(
      icon: Icons.code,
      title: '코딩 도움',
      prompt: '다음 코드를 작성해줘: ',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: SingleChildScrollView(
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
            if (variant == EmptyStateVariant.empty)
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: Spacing.sm,
                crossAxisSpacing: Spacing.sm,
                childAspectRatio: 2.2,
                children: _suggestions.map((card) {
                  return Card(
                    margin: EdgeInsets.zero,
                    child: InkWell(
                      onTap: isSending ? null : () => onSuggestion(card.prompt),
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: Spacing.sm,
                          vertical: Spacing.xs + 2,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              card.icon,
                              size: 20,
                              color: theme.colorScheme.primary,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              card.title,
                              style: theme.textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
          ],
        ),
      ),
    );
  }

  IconData get _icon => switch (variant) {
        EmptyStateVariant.disconnected => Icons.cloud_off,
        EmptyStateVariant.connecting => Icons.cloud_sync,
        EmptyStateVariant.empty => Icons.auto_awesome,
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
