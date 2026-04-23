import 'package:flutter/material.dart' show Colors, InkWell, Material;
import 'package:flutter/widgets.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/models/protocol.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class ActiveProviderCard extends StatelessWidget {
  const ActiveProviderCard({
    required this.provider,
    required this.onTap,
    super.key,
  });
  final ProviderInfo provider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;

    final label = provider.model.isNotEmpty
        ? '${provider.name}, ${provider.model}'
        : '${provider.name}, 모델 미선택';

    return Semantics(
      button: true,
      label: label,
      hint: '모델 변경',
      child: ShadCard(
        padding: EdgeInsets.zero,
        border: ShadBorder.all(
          radius: BorderRadius.circular(AppRadius.md),
          color: colorScheme.primary.withValues(alpha: 0.3),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: colorScheme.secondary,
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: Icon(
                      LucideIcons.bot,
                      size: 24,
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          provider.name,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.foreground,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          provider.model.isNotEmpty ? provider.model : '모델 미선택',
                          style: TextStyle(
                            fontSize: 12,
                            color: provider.model.isNotEmpty
                                ? colorScheme.mutedForeground
                                : colorScheme.destructive,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    LucideIcons.chevronRight,
                    color: colorScheme.mutedForeground,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
