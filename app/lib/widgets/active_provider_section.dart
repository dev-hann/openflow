import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/widgets/active_provider_card.dart';

class ActiveProviderSection extends StatelessWidget {
  const ActiveProviderSection({
    required this.providersState,
    required this.onTap,
    super.key,
  });

  final ProvidersState providersState;
  final ValueChanged<ProviderInfo> onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final active = providersState.activeProvider;

    return Padding(
      padding: const EdgeInsets.all(Spacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '활성 Provider',
            style: theme.textTheme.titleSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: Spacing.sm),
          if (active != null)
            ActiveProviderCard(
              provider: active,
              onTap: () => onTap(active),
            )
          else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(Spacing.md),
                child: Row(
                  children: [
                    Icon(Icons.info_outline,
                        size: 20, color: theme.colorScheme.onSurfaceVariant),
                    const SizedBox(width: Spacing.sm),
                    Expanded(
                      child: Text(
                        'Provider를 추가하고 활성화하세요',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
