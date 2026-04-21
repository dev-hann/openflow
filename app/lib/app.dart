import 'dart:async';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/config/theme.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/chat_cubit.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/screens/chat_screen.dart';
import 'package:openflow/screens/onboarding_screen.dart';
import 'package:openflow/screens/settings_screen.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/websocket_service.dart';
import 'package:openflow/widgets/app_drawer.dart';

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
      final api = createApiClient(authCubit.state.storedAuth!.serverUrl);
      final sessions = await api.listSessions(token);
      if (mounted) {
        context.read<SessionsCubit>().setSessions(sessions);
        if (sessions.isNotEmpty) {
          context.read<SessionsCubit>().setActiveSessionId(sessions.first.id);
        }
      }
    } on Object {
      // Session load failure is non-critical
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SessionsCubit, SessionsState>(
      builder: (context, sessionsState) {
        final activeSession = sessionsState.sessions
            .where((s) => s.id == sessionsState.activeSessionId)
            .firstOrNull;
        final title = activeSession?.title ?? '새 대화';

        return Scaffold(
          appBar: _buildAppBar(context, title),
          drawer: _buildDrawer(context, sessionsState),
          body: const ChatScreen(),
        );
      },
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, String title) {
    final theme = Theme.of(context);

    return AppBar(
      leading: Builder(
        builder: (scaffoldContext) => IconButton(
          icon: const Icon(Icons.menu),
          onPressed: () => Scaffold.of(scaffoldContext).openDrawer(),
        ),
      ),
      title: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: BlocBuilder<AuthCubit, AuthState>(
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
          ),
        ),
      ],
    );
  }

  Widget _buildDrawer(BuildContext context, SessionsState sessionsState) {
    return AppDrawer(
      sessions: sessionsState.sessions,
      activeSessionId: sessionsState.activeSessionId,
      onSessionTap: _handleSessionTap,
      onNewChat: _handleNewChat,
      onSessionDelete: _handleSessionDelete,
      onSettings: _handleSettings,
    );
  }

  void _handleSessionTap(String id) {
    Navigator.of(context).pop();
    final ws = context.read<WebSocketService>();
    final chatCubit = context.read<ChatCubit>();
    context.read<SessionsCubit>().setActiveSessionId(id);
    chatCubit.clearMessages();
    ws.send(WsSwitchSession(sessionId: id));
  }

  void _handleNewChat() {
    Navigator.of(context).pop();
    final chatCubit = context.read<ChatCubit>();
    context.read<SessionsCubit>().setActiveSessionId(null);
    chatCubit.clearMessages();
  }

  Future<void> _handleSessionDelete(String id) async {
    final authCubit = context.read<AuthCubit>();
    final token = await authCubit.getValidToken();
    if (token == null) return;
    try {
      final api = createApiClient(authCubit.state.storedAuth!.serverUrl);
      await api.deleteSession(token, id);
      if (!context.mounted) return;
      if (mounted) {
        context.read<SessionsCubit>().removeSession(id);
      }
    } on Object {
      // Session deletion failure is non-critical
    }
  }

  void _handleSettings() {
    Navigator.of(context).pop();
    unawaited(
      Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => const SettingsScreen(),
        ),
      ),
    );
  }
}
