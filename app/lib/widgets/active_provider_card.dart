import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/models/protocol.dart';

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

    return ShadCard(
      padding: EdgeInsets.zero,
      border: ShadBorder.all(
        radius: BorderRadius.circular(AppRadius.md),
        color: colorScheme.primary.withValues(alpha: 0.3),
      ),
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
                  Icons.smart_toy_outlined,
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
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      provider.model.isNotEmpty
                          ? provider.model
                          : '모델 미선택',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: provider.model.isNotEmpty
                                ? colorScheme.mutedForeground
                                : colorScheme.destructive,
                          ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: colorScheme.mutedForeground,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
