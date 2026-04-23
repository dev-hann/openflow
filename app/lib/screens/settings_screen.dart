import 'dart:async';

import 'package:flutter/material.dart' show MaterialPageRoute;
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/cubits/settings_cubit.dart';
import 'package:openflow/cubits/update_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/screens/provider_edit_screen.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/websocket_service.dart';
import 'package:openflow/utils/user_friendly_error.dart';
import 'package:openflow/widgets/active_provider_card.dart';
import 'package:openflow/widgets/app_scaffold.dart';
import 'package:openflow/widgets/app_spinner.dart';
import 'package:openflow/widgets/connection_section.dart';
import 'package:openflow/widgets/model_sheet.dart';
import 'package:openflow/widgets/provider_list_section.dart';
import 'package:openflow/widgets/update_section.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _isProvidersLoaded = false;
  String? _loadError;

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
      if (mounted) {
        context.read<ProvidersCubit>().setProviders(providers);
        setState(() {
          _isProvidersLoaded = true;
          _loadError = null;
        });
      }
    } on Object catch (e) {
      if (mounted) {
        setState(() {
          _isProvidersLoaded = true;
          _loadError = toUserMessage(e);
        });
      }
    }

    try {
      final sessions = await api.listSessions();
      if (mounted) context.read<SessionsCubit>().setSessions(sessions);
    } on Object {
      debugPrint('Failed to load sessions');
    }

    if (mounted) {
      unawaited(context.read<UpdateCubit>().loadCurrentVersion());
    }
  }

  Future<ApiClient?> _createApi() async {
    final authCubit = context.read<AuthCubit>();
    final token = await authCubit.getValidToken();
    if (token == null || !mounted) return null;
    return createApiClient(authCubit.state.storedAuth!.serverUrl, token: token);
  }

  Future<void> _handleServerChanged() async {
    final confirmed = await showShadDialog<bool>(
      context: context,
      builder: (ctx) => ShadDialog(
        title: const Text('서버 변경'),
        description: const Text('다른 서버로 변경하면 모든 데이터가 초기화됩니다. 계속하시겠습니까?'),
        actions: [
          ShadButton.outline(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('취소'),
          ),
          ShadButton.destructive(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('변경'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    context.read<WebSocketService>().disconnect();
    context.read<SessionsCubit>().setSessions([]);
    context.read<ProvidersCubit>().setProviders([]);
    context.read<SettingsCubit>().clearServerUrl();
    await context.read<AuthCubit>().clearAll();
    if (mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  Future<void> _switchProvider(String providerId) async {
    final providersCubit = context.read<ProvidersCubit>();
    final api = await _createApi();
    if (api == null) return;

    providersCubit.setSwitching(true);
    try {
      await api.switchProvider(providerId);
      final providers = await api.listProviders();
      if (mounted) providersCubit.setProviders(providers);
    } on Object catch (e) {
      if (mounted) {
        ShadToaster.of(context).show(
          ShadToast.destructive(
            title: Text('Provider 전환 실패: ${toUserMessage(e)}'),
          ),
        );
      }
    } finally {
      if (context.mounted) providersCubit.setSwitching(false);
    }
  }

  Future<void> _deleteProvider(String providerId) async {
    final providersCubit = context.read<ProvidersCubit>();
    final api = await _createApi();
    if (api == null) return;

    final provider = providersCubit.state.providers
        .where((p) => p.id == providerId)
        .firstOrNull;
    if (provider == null) return;

    if (!mounted) return;
    final confirmed = await showShadDialog<bool>(
      context: context,
      builder: (ctx) => ShadDialog(
        title: const Text('Provider 삭제'),
        description: Text("'${provider.name}'을(를) 삭제하시겠습니까?"),
        actions: [
          ShadButton.outline(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('취소'),
          ),
          ShadButton.destructive(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await api.deleteProvider(providerId);
      providersCubit.removeProvider(providerId);
    } on Object catch (e) {
      if (mounted) {
        ShadToaster.of(context).show(
          ShadToast.destructive(title: Text('삭제 실패: ${toUserMessage(e)}')),
        );
      }
    }
  }

  Future<void> _showModelSheet(ProviderInfo provider) async {
    final providersCubit = context.read<ProvidersCubit>();
    final api = await _createApi();
    if (api == null || !mounted) return;

    providersCubit.setLoadingModels(true);
    providersCubit.setAvailableModels([]);

    var models = <String>[];
    try {
      models = await api.fetchProviderModels(provider.id);
    } on Object {
      if (mounted) {
        ShadToaster.of(
          context,
        ).show(const ShadToast.destructive(title: Text('모델 목록을 불러올 수 없습니다')));
      }
    }

    providersCubit.setAvailableModels(models);
    if (!mounted) return;

    final selected = await ModelSheet.show(
      context: context,
      providerName: provider.name,
      models: models,
      currentModel: provider.model,
    );

    if (selected == null || selected == provider.model || !mounted) return;

    final updateApi = await _createApi();
    if (updateApi == null) return;

    try {
      final updated = await updateApi.updateProvider(provider.id, {
        'model': selected,
      });
      if (mounted) {
        context.read<ProvidersCubit>().updateProvider(updated);
      }
    } on Object catch (e) {
      if (mounted) {
        ShadToaster.of(context).show(
          ShadToast.destructive(title: Text('모델 변경 실패: ${toUserMessage(e)}')),
        );
      }
    }
  }

  Future<void> _navigateToProviderEdit([ProviderInfo? provider]) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => ProviderEditScreen(provider: provider),
      ),
    );
    if (mounted) unawaited(_loadData());
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '설정',
      leading: ShadIconButton.ghost(
        icon: Icon(
          LucideIcons.arrowLeft,
          color: ShadTheme.of(context).colorScheme.foreground,
        ),
        onPressed: () => Navigator.of(context).pop(),
      ),
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
    return ListView(
      children: [
        ConnectionSection(
          authState: authState,
          onServerChanged: _handleServerChanged,
        ),
        if (providersState.activeProvider != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: ActiveProviderCard(
              provider: providersState.activeProvider!,
              onTap: () => _showModelSheet(providersState.activeProvider!),
            ),
          ),
        const ShadSeparator.horizontal(),
        if (!_isProvidersLoaded)
          const Padding(
            padding: EdgeInsets.all(AppSpacing.xl),
            child: Center(child: AppSpinner()),
          )
        else if (_loadError != null)
          _LoadErrorBanner(
            error: _loadError!,
            onRetry: () {
              setState(() {
                _isProvidersLoaded = false;
                _loadError = null;
              });
              unawaited(_loadData());
            },
          )
        else
          ProviderListSection(
            providersState: providersState,
            onAdd: _navigateToProviderEdit,
            onSwitchProvider: _switchProvider,
            onShowModels: _showModelSheet,
            onEdit: _navigateToProviderEdit,
            onDelete: _deleteProvider,
          ),
        const ShadSeparator.horizontal(),
        const UpdateSection(),
      ],
    );
  }
}

class _LoadErrorBanner extends StatelessWidget {
  const _LoadErrorBanner({required this.error, required this.onRetry});

  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colorScheme.destructive.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Row(
          children: [
            Icon(
              LucideIcons.circleAlert,
              size: 20,
              color: colorScheme.destructive,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                error,
                style: TextStyle(fontSize: 14, color: colorScheme.destructive),
              ),
            ),
            ShadButton.outline(
              size: ShadButtonSize.sm,
              onPressed: onRetry,
              child: const Text('재시도'),
            ),
          ],
        ),
      ),
    );
  }
}
