import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/format_time.dart';

class AdaptiveScaffold extends StatelessWidget {
  const AdaptiveScaffold({
    required this.sessions,
    required this.activeSessionId,
    required this.onSessionTap,
    required this.onNewChat,
    required this.onSessionDelete,
    required this.onSettings,
    required this.child,
    super.key,
  });

  final List<SessionInfo> sessions;
  final String? activeSessionId;
  final ValueChanged<String> onSessionTap;
  final VoidCallback onNewChat;
  final ValueChanged<String> onSessionDelete;
  final VoidCallback onSettings;
  final Widget child;

  static const double _tabletBreakpoint = 600;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;

    if (width >= _tabletBreakpoint) {
      return _buildWideLayout(context);
    }
    return child;
  }

  Widget _buildWideLayout(BuildContext context) {
    final theme = Theme.of(context);
    final sortedSessions = List<SessionInfo>.from(sessions)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return Row(
      children: [
        _buildSidebar(context, sortedSessions, theme),
        Expanded(child: child),
      ],
    );
  }

  Widget _buildSidebar(
    BuildContext context,
    List<SessionInfo> sortedSessions,
    ThemeData theme,
  ) {
    return Container(
      width: 280,
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(
            color: theme.colorScheme.outlineVariant,
            width: 0.5,
          ),
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.only(
              top: Spacing.md + MediaQuery.of(context).padding.top,
              left: Spacing.md,
              right: Spacing.sm,
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
          const Divider(height: 1),
          Expanded(
            child: _TabletSessionList(
              sessions: sortedSessions,
              activeSessionId: activeSessionId,
              onSessionTap: onSessionTap,
              onSessionDelete: onSessionDelete,
            ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: const Text('설정'),
            onTap: onSettings,
          ),
        ],
      ),
    );
  }
}

class _TabletSessionList extends StatelessWidget {
  const _TabletSessionList({
    required this.sessions,
    required this.activeSessionId,
    required this.onSessionTap,
    required this.onSessionDelete,
  });

  final List<SessionInfo> sessions;
  final String? activeSessionId;
  final ValueChanged<String> onSessionTap;
  final ValueChanged<String> onSessionDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (sessions.isEmpty) {
      return Center(
        child: Text(
          '대화가 없습니다',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      );
    }

    return ListView.builder(
      itemCount: sessions.length,
      itemBuilder: (context, index) {
        final session = sessions[index];
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
            tooltip: '삭제',
            onPressed: () => _confirmDelete(context, session),
          ),
          onTap: () => onSessionTap(session.id),
        );
      },
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    SessionInfo session,
  ) async {
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
  }
}
