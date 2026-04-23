import 'dart:async';

import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:openflow/config/design_tokens.dart';
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
import 'package:shadcn_ui/shadcn_ui.dart';

class OpenFlowMaterialApp extends StatelessWidget {
  const OpenFlowMaterialApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ShadApp(
      title: 'OpenFlow',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      home: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, authState) {
          if (authState.storedAuth == null) {
            return OnboardingScreen(onComplete: () {});
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
    } on Object catch (e) {
      debugPrint('Failed to load sessions: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final shadTheme = ShadTheme.of(context);

    return BlocBuilder<SessionsCubit, SessionsState>(
      builder: (context, sessionsState) {
        final activeSession = sessionsState.sessions
            .where((s) => s.id == sessionsState.activeSessionId)
            .firstOrNull;
        final title = activeSession?.title ?? '새 대화';

        final scaffold = ColoredBox(
          color: shadTheme.colorScheme.background,
          child: SafeArea(
            child: Column(
              children: [
                _buildAppBar(context, title),
                const Expanded(child: ChatScreen()),
              ],
            ),
          ),
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

  Widget _buildAppBar(BuildContext context, String title) {
    final shadTheme = ShadTheme.of(context);
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: shadTheme.colorScheme.border, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          ShadIconButton.ghost(
            icon: Icon(
              LucideIcons.panelLeft,
              color: shadTheme.colorScheme.foreground,
            ),
            onPressed: _showSessionSheet,
          ),
          Expanded(
            child: GestureDetector(
              onTap: _showSessionSheet,
              child: _AppBarTitle(title: title),
            ),
          ),
          const Padding(
            padding: EdgeInsets.only(right: AppSpacing.md),
            child: _ConnectionIndicator(),
          ),
        ],
      ),
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
        final wasActive =
            context.read<SessionsCubit>().state.activeSessionId == id;
        context.read<SessionsCubit>().removeSession(id);
        if (wasActive) {
          final chatCubit = context.read<ChatCubit>();
          final ws = context.read<WebSocketService>();
          final newActiveId = context
              .read<SessionsCubit>()
              .state
              .activeSessionId;
          chatCubit.clearMessages();
          if (newActiveId != null) {
            ws.send(WsSwitchSession(sessionId: newActiveId));
          }
        }
      }
    } on Object catch (e) {
      debugPrint('Failed to delete session: $e');
    }
  }

  void _handleSettings() {
    unawaited(
      Navigator.of(context).push<void>(
        PageRouteBuilder<void>(
          pageBuilder: (_, _, _) => const SettingsScreen(),
          transitionsBuilder: (_, animation, _, child) => SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
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
    final shadTheme = ShadTheme.of(context);

    return Column(
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: shadTheme.colorScheme.foreground,
          ),
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
              style: TextStyle(
                fontSize: 11,
                color: shadTheme.colorScheme.mutedForeground,
              ),
            );
          },
        ),
      ],
    );
  }
}

class _ConnectionIndicator extends StatelessWidget {
  const _ConnectionIndicator();

  @override
  Widget build(BuildContext context) {
    final shadTheme = ShadTheme.of(context);
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, authState) {
        return Container(
          width: 8,
          height: 8,
          margin: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: authState.isConnected
                ? AppColors.success
                : shadTheme.colorScheme.destructive,
          ),
        );
      },
    );
  }
}
