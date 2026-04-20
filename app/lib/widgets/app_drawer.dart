import 'package:flutter/material.dart';
import '../constants/dimensions.dart';
import '../models/protocol.dart';
import '../utils/format_time.dart';

class AppDrawer extends StatelessWidget {
  final List<SessionInfo> sessions;
  final String? activeSessionId;
  final ValueChanged<String> onSessionTap;
  final VoidCallback onNewChat;
  final ValueChanged<String> onSessionDelete;
  final VoidCallback onSettings;

  const AppDrawer({
    super.key,
    required this.sessions,
    this.activeSessionId,
    required this.onSessionTap,
    required this.onNewChat,
    required this.onSessionDelete,
    required this.onSettings,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return NavigationDrawer(
      selectedIndex: null,
      onDestinationSelected: (_) {},
      children: [
        Padding(
          padding: EdgeInsets.only(
            left: Spacing.md,
            right: Spacing.sm,
            top: Spacing.md + MediaQuery.of(context).padding.top,
            bottom: Spacing.sm,
          ),
          child: Row(
            children: [
              Text('OpenFlow', style: theme.textTheme.titleLarge),
              const Spacer(),
              IconButton(
                onPressed: onNewChat,
                icon: const Icon(Icons.add),
                tooltip: '새 대화',
              ),
            ],
          ),
        ),
        const Divider(),
        if (sessions.isEmpty)
          Padding(
            padding: const EdgeInsets.all(Spacing.xl),
            child: Text(
              '대화가 없습니다',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ...sessions.map((session) {
          final isActive = session.id == activeSessionId;
          return ListTile(
            selected: isActive,
            selectedTileColor: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
            leading: const Icon(Icons.chat_bubble_outline, size: 20),
            title: Text(
              session.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              formatRelativeTime(session.createdAt),
              style: theme.textTheme.labelSmall,
            ),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline, size: 18),
              onPressed: () => onSessionDelete(session.id),
            ),
            onTap: () => onSessionTap(session.id),
          );
        }),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.settings_outlined),
          title: const Text('설정'),
          onTap: () {
            Navigator.of(context).pop();
            onSettings();
          },
        ),
      ],
    );
  }
}
