import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/widgets/session_sheet_content.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class SessionSheet extends StatelessWidget {
  const SessionSheet({
    required this.sessions,
    required this.onSessionTap,
    required this.onNewChat,
    required this.onSessionDelete,
    required this.onSettings,
    super.key,
    this.activeSessionId,
  });

  final List<SessionInfo> sessions;
  final String? activeSessionId;
  final ValueChanged<String> onSessionTap;
  final VoidCallback onNewChat;
  final ValueChanged<String> onSessionDelete;
  final VoidCallback onSettings;

  static Future<void> show({
    required BuildContext context,
    required List<SessionInfo> sessions,
    required ValueChanged<String> onSessionTap,
    required VoidCallback onNewChat,
    required ValueChanged<String> onSessionDelete,
    required VoidCallback onSettings,
    String? activeSessionId,
  }) {
    return showShadSheet(
      context: context,
      side: ShadSheetSide.bottom,
      builder: (_) => BlocBuilder<SessionsCubit, SessionsState>(
        builder: (context, sessionsState) => SessionSheet(
          sessions: sessionsState.sessions,
          activeSessionId: sessionsState.activeSessionId,
          onSessionTap: onSessionTap,
          onNewChat: onNewChat,
          onSessionDelete: onSessionDelete,
          onSettings: onSettings,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ShadSheet(
      child: SessionSheetContent(
        sessions: sessions,
        activeSessionId: activeSessionId,
        onSessionTap: (id) {
          Navigator.of(context).pop();
          onSessionTap(id);
        },
        onNewChat: () {
          Navigator.of(context).pop();
          onNewChat();
        },
        onSessionDelete: (id) {
          Navigator.of(context).pop();
          onSessionDelete(id);
        },
        onSettings: () {
          Navigator.of(context).pop();
          onSettings();
        },
      ),
    );
  }
}
