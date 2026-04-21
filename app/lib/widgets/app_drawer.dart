import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/format_time.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sortedSessions = List<SessionInfo>.from(sessions)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

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
        if (sortedSessions.isEmpty)
          Padding(
            padding: const EdgeInsets.all(Spacing.xl),
            child: Text(
              '대화가 없습니다',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ...sortedSessions.map((session) {
          final isActive = session.id == activeSessionId;
          return ListTile(
            selected: isActive,
            selectedTileColor:
                theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
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
              tooltip: '세션 삭제',
              onPressed: () async {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('세션 삭제'),
                    content: Text("'${session.title}' 세션을 삭제하시겠습니까?"),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('취소'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('삭제'),
                      ),
                    ],
                  ),
                );
                if (confirmed ?? false) {
                  onSessionDelete(session.id);
                }
              },
            ),
            onTap: () => onSessionTap(session.id),
          );
        }),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.settings_outlined),
          title: const Text('설정'),
          onTap: onSettings,
        ),
      ],
    );
  }
}
