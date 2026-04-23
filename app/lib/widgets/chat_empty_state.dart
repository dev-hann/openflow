import 'package:flutter/material.dart' show Colors, InkWell, Material;
import 'package:flutter/widgets.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

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
      icon: LucideIcons.penLine,
      title: '글쓰기 도움',
      prompt: '다음 주제로 글을 작성해줘: ',
    ),
    _SuggestionCard(
      icon: LucideIcons.search,
      title: '검색 도움',
      prompt: '다음에 대해 검색해줘: ',
    ),
    _SuggestionCard(
      icon: LucideIcons.lightbulb,
      title: '아이디어 브레인스토밍',
      prompt: '아이디어를 브레인스토밍해줘: ',
    ),
    _SuggestionCard(
      icon: LucideIcons.code,
      title: '코딩 도움',
      prompt: '다음 코드를 작성해줘: ',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(_icon, size: 64, color: colorScheme.mutedForeground),
            const SizedBox(height: AppSpacing.lg),
            Text(
              _title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: colorScheme.foreground,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              _subtitle,
              style: TextStyle(
                fontSize: 14,
                color: colorScheme.mutedForeground,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            if (variant == EmptyStateVariant.disconnected ||
                variant == EmptyStateVariant.connecting)
              ShadButton.outline(
                onPressed: variant == EmptyStateVariant.connecting
                    ? null
                    : onReconnect,
                child: Text(
                  variant == EmptyStateVariant.connecting ? '연결 중...' : '서버 연결',
                ),
              ),
            if (variant == EmptyStateVariant.empty)
              _SuggestionGrid(
                suggestions: _suggestions,
                isSending: isSending,
                onSuggestion: onSuggestion,
              ),
          ],
        ),
      ),
    );
  }

  IconData get _icon => switch (variant) {
    EmptyStateVariant.disconnected => LucideIcons.cloudOff,
    EmptyStateVariant.connecting => LucideIcons.cloudCog,
    EmptyStateVariant.empty => LucideIcons.sparkles,
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

class _SuggestionGrid extends StatelessWidget {
  const _SuggestionGrid({
    required this.suggestions,
    required this.isSending,
    required this.onSuggestion,
  });

  final List<_SuggestionCard> suggestions;
  final bool isSending;
  final ValueChanged<String> onSuggestion;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AppSpacing.sm,
      crossAxisSpacing: AppSpacing.sm,
      childAspectRatio: 2.2,
      children: suggestions.map((card) {
        return Semantics(
          button: true,
          label: card.title,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: isSending ? null : () => onSuggestion(card.prompt),
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: ShadCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 6,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(card.icon, size: 20, color: colorScheme.primary),
                    const SizedBox(height: 4),
                    Text(
                      card.title,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: colorScheme.foreground,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
