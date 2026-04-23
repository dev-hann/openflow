import 'package:flutter/widgets.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import 'package:openflow/config/design_tokens.dart';
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
    final colorScheme = ShadTheme.of(context).colorScheme;
    final active = providersState.activeProvider;

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '활성 Provider',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: colorScheme.mutedForeground,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (active != null)
            ActiveProviderCard(
              provider: active,
              onTap: () => onTap(active),
            )
          else
            ShadCard(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Icon(LucideIcons.info,
                      size: 20, color: colorScheme.mutedForeground),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Provider를 추가하고 활성화하세요',
                      style: TextStyle(
                        fontSize: 14,
                        color: colorScheme.mutedForeground,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
