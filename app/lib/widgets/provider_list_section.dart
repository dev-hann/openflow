import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import 'package:openflow/config/design_tokens.dart';
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader(context),
        if (providersState.providers.isEmpty) _buildEmptyState(context),
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

  Widget _buildHeader(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Row(
        children: [
          Text(
            'Provider',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: colorScheme.mutedForeground,
                ),
          ),
          const Spacer(),
          ShadButton.ghost(
            onPressed: onAdd,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.add, size: 18),
                SizedBox(width: 4),
                Text('추가'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Center(
        child: Text(
          '등록된 Provider가 없습니다',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.mutedForeground,
              ),
        ),
      ),
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
    return ListTile(
      leading: _buildStatusIndicator(context),
      title: Row(
        children: [
          Expanded(child: Text(provider.name)),
          if (isActive)
            ShadBadge(
              child: Text('활성'),
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
          : _buildActions(context),
      onTap: onTap,
    );
  }

  Widget _buildStatusIndicator(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    if (isActive) {
      return Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: colorScheme.secondary,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Icon(
          Icons.check_circle,
          color: colorScheme.primary,
          size: 20,
        ),
      );
    }
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: colorScheme.card,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: const Icon(Icons.dns_outlined, size: 20),
    );
  }

  Widget _buildActions(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (onModels != null)
          ShadIconButton.ghost(
            icon: const Icon(Icons.tune, size: 20),
            onPressed: onModels,
          ),
        if (onEdit != null)
          ShadIconButton.ghost(
            icon: const Icon(Icons.edit_outlined, size: 20),
            onPressed: onEdit,
          ),
        if (onDelete != null)
          ShadIconButton.ghost(
            icon: Icon(
              Icons.delete_outline,
              size: 20,
              color: colorScheme.destructive,
            ),
            onPressed: onDelete,
          ),
      ],
    );
  }
}
