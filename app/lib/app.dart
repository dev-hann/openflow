import 'dart:async';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/config/theme.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/chat_cubit.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/screens/chat_screen.dart';
import 'package:openflow/screens/onboarding_screen.dart';
import 'package:openflow/screens/settings_screen.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/websocket_service.dart';
import 'package:openflow/widgets/adaptive_scaffold.dart';
import 'package:openflow/widgets/session_sheet.dart';

class OpenFlowMaterialApp extends StatelessWidget {
  const OpenFlowMaterialApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OpenFlow',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      debugShowCheckedModeBanner: false,
      home: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, authState) {
          if (authState.storedAuth == null) {
            return OnboardingScreen(
              onComplete: () {},
            );
          }
          return const MainScreen();
        },
      ),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(_loadSessions());
  }

  Future<void> _loadSessions() async {
    final authCubit = context.read<AuthCubit>();
    final token = await authCubit.getValidToken();
    if (token == null || !mounted) return;

    try {
      final api = createApiClient(
        authCubit.state.storedAuth!.serverUrl,
        token: token,
      );
      final sessions = await api.listSessions();
      if (mounted) {
        context.read<SessionsCubit>().setSessions(sessions);
        if (sessions.isNotEmpty) {
          context.read<SessionsCubit>().setActiveSessionId(sessions.first.id);
        }
      }
    } on Object {}
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SessionsCubit, SessionsState>(
      builder: (context, sessionsState) {
        final activeSession = sessionsState.sessions
            .where((s) => s.id == sessionsState.activeSessionId)
            .firstOrNull;
        final title = activeSession?.title ?? '새 대화';

        final scaffold = Scaffold(
          appBar: _buildAppBar(context, title),
          body: const ChatScreen(),
        );

        return AdaptiveScaffold(
          sessions: sessionsState.sessions,
          activeSessionId: sessionsState.activeSessionId,
          onSessionTap: _handleSessionTap,
          onNewChat: _handleNewChat,
          onSessionDelete: _handleSessionDelete,
          onSettings: _handleSettings,
          child: scaffold,
        );
      },
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, String title) {
    final theme = Theme.of(context);

    return AppBar(
      leading: IconButton(
        icon: const Icon(Icons.menu),
        onPressed: _showSessionSheet,
      ),
      title: GestureDetector(
        onTap: _showSessionSheet,
        child: _AppBarTitle(title: title),
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: _ConnectionIndicator(theme: theme),
        ),
      ],
    );
  }

  void _showSessionSheet() {
    final cubit = context.read<SessionsCubit>();
    SessionSheet.show(
      context: context,
      sessions: cubit.state.sessions,
      activeSessionId: cubit.state.activeSessionId,
      onSessionTap: _handleSessionTap,
      onNewChat: _handleNewChat,
      onSessionDelete: _handleSessionDelete,
      onSettings: _handleSettings,
    );
  }

  void _handleSessionTap(String id) {
    final ws = context.read<WebSocketService>();
    final chatCubit = context.read<ChatCubit>();
    context.read<SessionsCubit>().setActiveSessionId(id);
    chatCubit.clearMessages();
    ws.send(WsSwitchSession(sessionId: id));
  }

  void _handleNewChat() {
    final chatCubit = context.read<ChatCubit>();
    context.read<SessionsCubit>().setActiveSessionId(null);
    chatCubit.clearMessages();
  }

  Future<void> _handleSessionDelete(String id) async {
    final authCubit = context.read<AuthCubit>();
    final token = await authCubit.getValidToken();
    if (token == null) return;
    try {
      final api = createApiClient(
        authCubit.state.storedAuth!.serverUrl,
        token: token,
      );
      await api.deleteSession(id);
      if (mounted) {
        context.read<SessionsCubit>().removeSession(id);
      }
    } on Object {}
  }

  void _handleSettings() {
    unawaited(
      Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => const SettingsScreen(),
        ),
      ),
    );
  }
}

class _AppBarTitle extends StatelessWidget {
  const _AppBarTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.titleMedium,
        ),
        BlocBuilder<ProvidersCubit, ProvidersState>(
          builder: (context, providersState) {
            final active = providersState.activeProvider;
            if (active == null) return const SizedBox.shrink();
            final label = active.model.isNotEmpty
                ? '${active.name} · ${active.model}'
                : active.name;
            return Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            );
          },
        ),
      ],
    );
  }
}

class _ConnectionIndicator extends StatelessWidget {
  const _ConnectionIndicator({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, authState) {
        return Container(
          width: 8,
          height: 8,
          margin: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: authState.isConnected
                ? theme.colorScheme.tertiary
                : theme.colorScheme.error,
          ),
        );
      },
    );
  }
}
