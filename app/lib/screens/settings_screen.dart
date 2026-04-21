import 'dart:async';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/cubits/settings_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/screens/provider_edit_screen.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/websocket_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(_loadData());
  }

  Future<void> _loadData() async {
    final authCubit = context.read<AuthCubit>();
    final token = await authCubit.getValidToken();
    if (token == null || !mounted) return;

    final serverUrl = authCubit.state.storedAuth?.serverUrl;
    if (serverUrl == null) return;

    final api = createApiClient(serverUrl);

    try {
      final providers = await api.listProviders(token);
      if (mounted) context.read<ProvidersCubit>().setProviders(providers);
    } on Object {
      // Provider load failure is non-critical
    }

    try {
      final sessions = await api.listSessions(token);
      if (mounted) context.read<SessionsCubit>().setSessions(sessions);
    } on Object {
      // Session load failure is non-critical
    }
  }

  Future<void> _handleServerChanged() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('서버 변경'),
        content: const Text('다른 서버로 변경하면 모든 데이터가 초기화됩니다. 계속하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('변경'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final authCubit = context.read<AuthCubit>();
    final ws = context.read<WebSocketService>();
    final sessionsCubit = context.read<SessionsCubit>();
    final providersCubit = context.read<ProvidersCubit>();
    final settingsCubit = context.read<SettingsCubit>();
    ws.disconnect();
    sessionsCubit.setSessions([]);
    providersCubit.setProviders([]);
    settingsCubit.clearServerUrl();
    await authCubit.clearAll();
    if (mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  Future<void> _switchProvider(String providerId) async {
    final authCubit = context.read<AuthCubit>();
    final providersCubit = context.read<ProvidersCubit>();
    final token = await authCubit.getValidToken();
    if (token == null) return;

    providersCubit.setSwitching(true);
    try {
      final api = createApiClient(authCubit.state.storedAuth!.serverUrl);
      await api.switchProvider(token, providerId);
      providersCubit.setActiveProviderId(providerId);
      final providers = await api.listProviders(token);
      providersCubit.setProviders(providers);
    } on Object catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Provider 전환 실패: $e')),
        );
      }
    } finally {
      providersCubit.setSwitching(false);
    }
  }

  Future<void> _deleteProvider(String providerId) async {
    final authCubit = context.read<AuthCubit>();
    final providersCubit = context.read<ProvidersCubit>();
    final token = await authCubit.getValidToken();
    if (token == null) return;

    final provider = providersCubit.state.providers
        .where((p) => p.id == providerId)
        .firstOrNull;
    if (provider == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Provider 삭제'),
        content: Text("'${provider.name}'을(를) 삭제하시겠습니까?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      final api = createApiClient(authCubit.state.storedAuth!.serverUrl);
      await api.deleteProvider(token, providerId);
      providersCubit.removeProvider(providerId);
    } on Object catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('삭제 실패: $e')),
        );
      }
    }
  }

  Future<void> _showModelSheet(ProviderInfo provider) async {
    final authCubit = context.read<AuthCubit>();
    final providersCubit = context.read<ProvidersCubit>();
    final token = await authCubit.getValidToken();
    if (token == null || !mounted) return;

    providersCubit.setLoadingModels(true);
    providersCubit.setAvailableModels([]);

    List<String> models = [];
    try {
      final api = createApiClient(authCubit.state.storedAuth!.serverUrl);
      models = await api.fetchProviderModels(token, provider.id);
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('모델 목록을 불러올 수 없습니다')),
        );
      }
    }

    providersCubit.setAvailableModels(models);
    if (!mounted) return;

    final selected = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => _ModelSheet(
        providerName: provider.name,
        models: models,
        currentModel: provider.model,
      ),
    );

    if (selected == null || selected == provider.model || !mounted) return;

    final authCubit2 = context.read<AuthCubit>();
    final token2 = await authCubit2.getValidToken();
    if (token2 == null) return;

    try {
      final api = createApiClient(authCubit2.state.storedAuth!.serverUrl);
      final updated = await api.updateProvider(token2, provider.id, {
        'model': selected,
      });
      context.read<ProvidersCubit>().updateProvider(updated);
    } on Object catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('모델 변경 실패: $e')),
        );
      }
    }
  }

  void _navigateToProviderEdit([ProviderInfo? provider]) {
    unawaited(
      Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => ProviderEditScreen(provider: provider),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('설정')),
      body: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, authState) {
          return BlocBuilder<ProvidersCubit, ProvidersState>(
            builder: (context, providersState) {
              return _buildContent(authState, providersState);
            },
          );
        },
      ),
    );
  }

  Widget _buildContent(AuthState authState, ProvidersState providersState) {
    final theme = Theme.of(context);

    return ListView(
      children: [
        _buildConnectionTile(authState),
        const Divider(height: 1),
        _buildActiveProviderSection(theme, providersState),
        const Divider(height: 1),
        _buildProvidersList(theme, providersState),
        const Divider(height: 1),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.md,
            vertical: Spacing.xl,
          ),
          child: Center(
            child: Text(
              'OpenFlow v0.4.0',
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildConnectionTile(AuthState authState) {
    final theme = Theme.of(context);
    final connected = authState.isConnected;
    final url = authState.storedAuth?.serverUrl;

    return ListTile(
      leading: Icon(
        connected ? Icons.cloud_done_outlined : Icons.cloud_off_outlined,
        color: connected ? theme.colorScheme.tertiary : theme.colorScheme.error,
      ),
      title: Text(connected ? '연결됨' : '연결 안됨'),
      subtitle: url != null
          ? Text(url, style: theme.textTheme.bodySmall)
          : null,
      trailing: OutlinedButton(
        onPressed: _handleServerChanged,
        style: OutlinedButton.styleFrom(
          foregroundColor: theme.colorScheme.error,
          side: BorderSide(color: theme.colorScheme.error.withValues(alpha: 0.5)),
        ),
        child: const Text('서버 변경'),
      ),
    );
  }

  Widget _buildActiveProviderSection(
    ThemeData theme,
    ProvidersState providersState,
  ) {
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
            _ActiveProviderCard(
              provider: active,
              onTap: () => _showModelSheet(active),
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

  Widget _buildProvidersList(
    ThemeData theme,
    ProvidersState providersState,
  ) {
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
              Text('Provider', style: theme.textTheme.titleSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              )),
              const Spacer(),
              TextButton.icon(
                onPressed: () => _navigateToProviderEdit(),
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
          final isSwitching = providersState.isSwitching;
          return _ProviderTile(
            provider: provider,
            isActive: isActive,
            isSwitching: isSwitching && !isActive,
            onTap: isActive
                ? null
                : () => _switchProvider(provider.id),
            onModels: isActive ? () => _showModelSheet(provider) : null,
            onEdit: () => _navigateToProviderEdit(provider),
            onDelete: isActive
                ? null
                : () => _deleteProvider(provider.id),
          );
        }),
      ],
    );
  }
}

class _ActiveProviderCard extends StatelessWidget {
  const _ActiveProviderCard({
    required this.provider,
    required this.onTap,
  });
  final ProviderInfo provider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: BorderSide(color: theme.colorScheme.primary.withValues(alpha: 0.3)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Padding(
          padding: const EdgeInsets.all(Spacing.md),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(Spacing.sm),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Icon(
                  Icons.smart_toy_outlined,
                  size: 24,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(width: Spacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      provider.name,
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      provider.model.isNotEmpty ? provider.model : '모델 미선택',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: provider.model.isNotEmpty
                            ? theme.colorScheme.onSurfaceVariant
                            : theme.colorScheme.error,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
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
        child: Icon(Icons.check_circle, color: theme.colorScheme.primary, size: 20),
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
            icon: Icon(Icons.delete_outline, size: 20,
                color: theme.colorScheme.error),
            tooltip: '삭제',
            onPressed: onDelete,
          ),
      ],
    );
  }
}

class _ModelSheet extends StatelessWidget {
  const _ModelSheet({
    required this.providerName,
    required this.models,
    required this.currentModel,
  });
  final String providerName;
  final List<String> models;
  final String currentModel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
                  '$providerName 모델',
                  style: theme.textTheme.titleMedium,
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (models.isEmpty)
            const Padding(
              padding: EdgeInsets.all(Spacing.xl),
              child: Text('사용 가능한 모델이 없습니다'),
            ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: models.length,
              itemBuilder: (context, index) {
                final model = models[index];
                final isActive = model == currentModel;
                return ListTile(
                  leading: Icon(
                    isActive
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: isActive ? theme.colorScheme.primary : null,
                  ),
                  title: Text(
                    model,
                    style: isActive
                        ? TextStyle(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w600,
                          )
                        : null,
                  ),
                  trailing: isActive
                      ? Text(
                          '사용 중',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.primary,
                          ),
                        )
                      : null,
                  onTap: () => Navigator.of(context).pop(model),
                );
              },
            ),
          ),
          const SizedBox(height: Spacing.md),
        ],
      ),
    );
  }
}
