import 'dart:async';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/cubits/settings_cubit.dart';
import 'package:openflow/cubits/update_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/screens/provider_edit_screen.dart';
import 'package:openflow/screens/qr_scanner_screen.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/websocket_service.dart';
import 'package:openflow/widgets/active_provider_card.dart';
import 'package:openflow/widgets/connection_section.dart';
import 'package:openflow/widgets/model_sheet.dart';
import 'package:openflow/widgets/provider_list_section.dart';
import 'package:openflow/widgets/update_section.dart';

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
    } on Object {}

    try {
      final sessions = await api.listSessions();
      if (mounted) context.read<SessionsCubit>().setSessions(sessions);
    } on Object {}

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
      final providers = await api.listProviders();
      if (mounted) providersCubit.setProviders(providers);
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

    final selected = await ModelSheet.show(
      context: context,
      providerName: provider.name,
      models: models,
      currentModel: provider.model,
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
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        children: [
          ConnectionSection(
            authState: authState,
            onServerChanged: _handleServerChanged,
          ),
          if (authState.storedAuth != null) ...[
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.qr_code_scanner),
              title: const Text('웹 로그인'),
              subtitle: const Text('QR 코드로 웹에서 로그인'),
              onTap: () => Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const QrScannerScreen(),
                ),
              ),
            ),
          ],
          if (providersState.activeProvider != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: ActiveProviderCard(
                provider: providersState.activeProvider!,
                onTap: () => _showModelSheet(providersState.activeProvider!),
              ),
            ),
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
          const UpdateSection(),
        ],
      ),
    );
  }
}
