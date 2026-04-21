import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/models/protocol.dart';

class ProviderListSection extends StatelessWidget {
  const ProviderListSection({
    required this.providersState,
    required this.onAdd,
    required this.onSwitchProvider,
    required this.onShowModels,
    required this.onEdit,
    required this.onDelete,
    super.key,
  });

  final ProvidersState providersState;
  final VoidCallback onAdd;
  final void Function(String providerId) onSwitchProvider;
  final void Function(ProviderInfo provider) onShowModels;
  final void Function(ProviderInfo provider) onEdit;
  final void Function(String providerId) onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            Spacing.md,
            Spacing.md,
            Spacing.md,
            Spacing.sm,
          ),
          child: Row(
            children: [
              Text(
                'Provider',
                style: theme.textTheme.titleSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: onAdd,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('추가'),
              ),
            ],
          ),
        ),
        if (providersState.providers.isEmpty)
          Padding(
            padding: const EdgeInsets.all(Spacing.xl),
            child: Center(
              child: Text(
                '등록된 Provider가 없습니다',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ...providersState.providers.map((provider) {
          final isActive = provider.id == providersState.activeProviderId;
          final isSwitching = providersState.isSwitching && !isActive;
          return _ProviderTile(
            provider: provider,
            isActive: isActive,
            isSwitching: isSwitching,
            onTap: isActive ? null : () => onSwitchProvider(provider.id),
            onModels: isActive ? () => onShowModels(provider) : null,
            onEdit: () => onEdit(provider),
            onDelete: isActive ? null : () => onDelete(provider.id),
          );
        }),
      ],
    );
  }
}

class _ProviderTile extends StatelessWidget {
  const _ProviderTile({
    required this.provider,
    required this.isActive,
    required this.isSwitching,
    required this.onTap,
    this.onModels,
    this.onEdit,
    this.onDelete,
  });

  final ProviderInfo provider;
  final bool isActive;
  final bool isSwitching;
  final VoidCallback? onTap;
  final VoidCallback? onModels;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListTile(
      leading: _buildStatusIndicator(theme),
      title: Row(
        children: [
          Expanded(child: Text(provider.name)),
          if (isActive)
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
              child: Text(
                '활성',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      subtitle: Text(
        provider.model.isNotEmpty ? provider.model : provider.baseUrl,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: isSwitching
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : _buildActions(theme),
      onTap: onTap,
    );
  }

  Widget _buildStatusIndicator(ThemeData theme) {
    if (isActive) {
      return Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: theme.colorScheme.primaryContainer,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Icon(
          Icons.check_circle,
          color: theme.colorScheme.primary,
          size: 20,
        ),
      );
    }
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: const Icon(Icons.dns_outlined, size: 20),
    );
  }

  Widget _buildActions(ThemeData theme) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (onModels != null)
          IconButton(
            icon: const Icon(Icons.tune, size: 20),
            tooltip: '모델 변경',
            onPressed: onModels,
          ),
        if (onEdit != null)
          IconButton(
            icon: const Icon(Icons.edit_outlined, size: 20),
            tooltip: '편집',
            onPressed: onEdit,
          ),
        if (onDelete != null)
          IconButton(
            icon: Icon(
              Icons.delete_outline,
              size: 20,
              color: theme.colorScheme.error,
            ),
            tooltip: '삭제',
            onPressed: onDelete,
          ),
      ],
    );
  }
}
