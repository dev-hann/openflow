import 'dart:async';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/cubits/settings_cubit.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/websocket_service.dart';
import 'package:openflow/widgets/connection_section.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, this.onProviderEdit});
  final VoidCallback? onProviderEdit;

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
    final authCubit = context.read<AuthCubit>();
    final ws = context.read<WebSocketService>();
    final sessionsCubit = context.read<SessionsCubit>();
    final providersCubit = context.read<ProvidersCubit>();
    final settingsCubit = context.read<SettingsCubit>();
    ws.disconnect();
    await authCubit.clearAll();
    sessionsCubit.setSessions([]);
    providersCubit.setProviders([]);
    settingsCubit.clearServerUrl();
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('설정')),
      body: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, authState) {
          return BlocBuilder<ProvidersCubit, ProvidersState>(
            builder: (context, providersState) {
              return BlocBuilder<SettingsCubit, SettingsState>(
                builder: (context, settingsState) {
                  return _buildContent(
                    theme,
                    authState,
                    providersState,
                    settingsState,
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildContent(
    ThemeData theme,
    AuthState authState,
    ProvidersState providersState,
    SettingsState settingsState,
  ) {
    return ListView(
      padding: const EdgeInsets.all(Spacing.md),
      children: [
        ConnectionSection(
          isConnected: authState.isConnected,
          serverUrl: authState.storedAuth?.serverUrl,
          onServerChanged: _handleServerChanged,
        ),
        const SizedBox(height: Spacing.lg),
        _buildModelCard(theme, settingsState),
        const SizedBox(height: Spacing.lg),
        _buildProviderSection(theme, providersState),
        if (settingsState.availableModels.isNotEmpty) ...[
          const SizedBox(height: Spacing.lg),
          _buildModelChips(settingsState),
        ],
        const SizedBox(height: Spacing.xxl),
        Center(
          child: Text(
            'OpenFlow v1.0.0',
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildModelCard(ThemeData theme, SettingsState settingsState) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('AI 모델', style: theme.textTheme.titleSmall),
            const SizedBox(height: Spacing.sm),
            Text(
              settingsState.currentModel ?? '선택되지 않음',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: settingsState.currentModel != null
                    ? null
                    : theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProviderSection(
    ThemeData theme,
    ProvidersState providersState,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Provider', style: theme.textTheme.titleMedium),
            const Spacer(),
            TextButton.icon(
              onPressed: widget.onProviderEdit,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('추가'),
            ),
          ],
        ),
        const SizedBox(height: Spacing.sm),
        ...providersState.providers.map((provider) {
          final isActive = provider.id == providersState.activeProviderId;
          return Card(
            child: ListTile(
              leading: Icon(
                Icons.dns_outlined,
                color: isActive ? theme.colorScheme.primary : null,
              ),
              title: Text(provider.name),
              subtitle: Text(provider.model),
              trailing: isActive ? const Chip(label: Text('활성')) : null,
              onTap: isActive ? null : () => _switchProvider(provider.id),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildModelChips(SettingsState settingsState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('모델', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: Spacing.sm),
        Wrap(
          spacing: Spacing.xs,
          children: settingsState.availableModels.map((model) {
            return ChoiceChip(
              label: Text(model),
              selected: model == settingsState.currentModel,
              onSelected: (_) {
                context.read<SettingsCubit>().setCurrentModel(model);
              },
            );
          }).toList(),
        ),
      ],
    );
  }
}
