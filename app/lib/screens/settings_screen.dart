import 'dart:async';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:open_filex/open_filex.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/cubits/settings_cubit.dart';
import 'package:openflow/cubits/update_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/screens/provider_edit_screen.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/update_service.dart';
import 'package:openflow/services/websocket_service.dart';
import 'package:openflow/widgets/active_provider_card.dart';
import 'package:openflow/widgets/connection_section.dart';
import 'package:openflow/widgets/provider_list_section.dart';

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

    final api = createApiClient(serverUrl, token: token);

    try {
      final providers = await api.listProviders();
      if (mounted) context.read<ProvidersCubit>().setProviders(providers);
    } on Object {
    }

    try {
      final sessions = await api.listSessions();
      if (mounted) context.read<SessionsCubit>().setSessions(sessions);
    } on Object {
    }

    if (mounted) {
      unawaited(context.read<UpdateCubit>().loadCurrentVersion());
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
      final api = createApiClient(
        authCubit.state.storedAuth!.serverUrl,
        token: token,
      );
      await api.switchProvider(providerId);
      providersCubit.setActiveProviderId(providerId);
      final providers = await api.listProviders();
      providersCubit.setProviders(providers);
    } on Object catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Provider 전환 실패: $e')),
        );
      }
    } finally {
      if (context.mounted) {
        providersCubit.setSwitching(false);
      }
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
      final api = createApiClient(
        authCubit.state.storedAuth!.serverUrl,
        token: token,
      );
      await api.deleteProvider(providerId);
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

    var models = <String>[];
    try {
      final api = createApiClient(
        authCubit.state.storedAuth!.serverUrl,
        token: token,
      );
      models = await api.fetchProviderModels(provider.id);
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

    final freshToken = await authCubit.getValidToken();
    if (freshToken == null) return;

    try {
      final api = createApiClient(
        authCubit.state.storedAuth!.serverUrl,
        token: freshToken,
      );
      final updated = await api.updateProvider(provider.id, {
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

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        children: [
          ConnectionSection(
            authState: authState,
            onServerChanged: _handleServerChanged,
          ),
          const Divider(height: 1),
          _buildActiveProviderSection(theme, providersState),
          const Divider(height: 1),
          ProviderListSection(
            providersState: providersState,
            onAdd: _navigateToProviderEdit,
            onSwitchProvider: _switchProvider,
            onShowModels: _showModelSheet,
            onEdit: _navigateToProviderEdit,
            onDelete: _deleteProvider,
          ),
          const Divider(height: 1),
          _buildVersionSection(theme),
        ],
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
            ActiveProviderCard(
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

  Widget _buildVersionSection(ThemeData theme) {
    return BlocBuilder<UpdateCubit, UpdateState>(
      builder: (context, updateState) {
        final updateCubit = context.read<UpdateCubit>();

        return Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.md,
            vertical: Spacing.xl,
          ),
          child: Column(
            children: [
              Text(
                'OpenFlow v${updateState.currentVersion}',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
              const SizedBox(height: Spacing.sm),
              _buildUpdateAction(theme, updateState, updateCubit),
            ],
          ),
        );
      },
    );
  }

  Widget _buildUpdateAction(
    ThemeData theme,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    switch (updateState.status) {
      case UpdateStatus.idle:
        return TextButton.icon(
          onPressed: updateCubit.checkForUpdate,
          icon: const Icon(Icons.system_update_outlined, size: 18),
          label: const Text('업데이트 확인'),
        );

      case UpdateStatus.checking:
        return const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        );

      case UpdateStatus.upToDate:
        return Text(
          '최신 버전입니다',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.tertiary,
          ),
        );

      case UpdateStatus.available:
        return _buildUpdateAvailable(theme, updateState, updateCubit);

      case UpdateStatus.downloading:
        return _buildDownloadProgress(theme, updateState);

      case UpdateStatus.readyToInstall:
        return _buildInstallButton(theme, updateState, updateCubit);

      case UpdateStatus.error:
        return Column(
          children: [
            Text(
              updateState.errorMessage ?? '오류가 발생했습니다',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: Spacing.xs),
            TextButton(
              onPressed: updateCubit.reset,
              child: const Text('다시 시도'),
            ),
          ],
        );
    }
  }

  Widget _buildUpdateAvailable(
    ThemeData theme,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    final release = updateState.release!;
    final updateService = context.read<UpdateService>();
    final asset = release.assets
        .where((a) => a.name.endsWith('.apk'))
        .where((a) => a.name.contains('arm64'))
        .firstOrNull;
    final sizeText =
        asset != null ? updateService.formatFileSize(asset.size) : '';

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: theme.colorScheme.primary.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.new_releases_outlined,
                    size: 18,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: Spacing.xs),
                  Text(
                    '${release.tagName} 사용 가능',
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  if (sizeText.isNotEmpty) ...[
                    const Spacer(),
                    Text(
                      sizeText,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
              if (release.releaseNotes.isNotEmpty) ...[
                const SizedBox(height: Spacing.sm),
                Text(
                  release.releaseNotes,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 5,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: Spacing.sm),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FilledButton.icon(
              onPressed: updateCubit.downloadUpdate,
              icon: const Icon(Icons.download, size: 18),
              label: const Text('업데이트'),
            ),
            const SizedBox(width: Spacing.sm),
            TextButton(
              onPressed: () => _openReleasePage(release.htmlUrl),
              child: const Text('릴리즈 페이지'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDownloadProgress(ThemeData theme, UpdateState updateState) {
    return Column(
      children: [
        Text(
          '다운로드 중... ${updateState.downloadProgress}%',
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: Spacing.xs),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Spacing.lg),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.full),
            child: LinearProgressIndicator(
              value: updateState.downloadProgress / 100,
              minHeight: 6,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInstallButton(
    ThemeData theme,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    return Column(
      children: [
        FilledButton.icon(
          onPressed: () => _installApk(updateState.downloadedFilePath!),
          icon: const Icon(Icons.install_mobile, size: 18),
          label: const Text('설치'),
        ),
        const SizedBox(height: Spacing.xs),
        Text(
          '다운로드 완료',
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.tertiary,
          ),
        ),
      ],
    );
  }

  Future<void> _installApk(String filePath) async {
    try {
      await OpenFilex.open(filePath);
    } on Object {
      if (!mounted) return;
      final release = context.read<UpdateCubit>().state.release;
      if (release != null) {
        await _openReleasePage(release.htmlUrl);
      }
    }
  }

  Future<void> _openReleasePage(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
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
