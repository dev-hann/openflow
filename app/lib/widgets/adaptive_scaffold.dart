import 'package:flutter/material.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/format_time.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

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
    final colorScheme = ShadTheme.of(context).colorScheme;
    final sortedSessions = List<SessionInfo>.from(sessions)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return Row(
      children: [
        _buildSidebar(context, sortedSessions, colorScheme),
        Expanded(child: child),
      ],
    );
  }

  Widget _buildSidebar(
    BuildContext context,
    List<SessionInfo> sortedSessions,
    ShadColorScheme colorScheme,
  ) {
    return Container(
      width: 280,
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(
            color: colorScheme.border,
            width: 0.5,
          ),
        ),
      ),
      child: Column(
        children: [
          _buildSidebarHeader(context),
          const ShadSeparator.horizontal(),
          Expanded(
            child: _TabletSessionList(
              sessions: sortedSessions,
              activeSessionId: activeSessionId,
              onSessionTap: onSessionTap,
              onSessionDelete: onSessionDelete,
            ),
          ),
          const ShadSeparator.horizontal(),
          ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: const Text('설정'),
            onTap: onSettings,
          ),
        ],
      ),
    );
  }

  Widget _buildSidebarHeader(BuildContext context) {
    final theme = ShadTheme.of(context);
    return Padding(
      padding: EdgeInsets.only(
        top: AppSpacing.md + MediaQuery.of(context).padding.top,
        left: AppSpacing.md,
        right: AppSpacing.sm,
        bottom: AppSpacing.sm,
      ),
      child: Row(
        children: [
          Text('OpenFlow', style: theme.textTheme.large),
          const Spacer(),
          ShadIconButton.ghost(
            onPressed: onNewChat,
            icon: const Icon(Icons.add),
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
    final theme = ShadTheme.of(context);

    if (sessions.isEmpty) {
      return Center(
        child: Text(
          '대화가 없습니다',
          style: theme.textTheme.muted,
        ),
      );
    }

    return ListView.builder(
      itemCount: sessions.length,
      itemBuilder: (context, index) {
        final session = sessions[index];
        final isActive = session.id == activeSessionId;
        return Container(
          color: isActive
              ? theme.colorScheme.primary.withValues(alpha: 0.1)
              : null,
          child: ListTile(
            leading: const Icon(Icons.chat_bubble_outline, size: 20),
            title: Text(
              session.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              formatRelativeTime(session.createdAt),
              style: theme.textTheme.muted,
            ),
            trailing: ShadIconButton.ghost(
              icon: const Icon(Icons.delete_outline, size: 18),
              onPressed: () => _confirmDelete(context, session),
            ),
            onTap: () => onSessionTap(session.id),
          ),
        );
      },
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    SessionInfo session,
  ) async {
    final confirmed = await showShadDialog<bool>(
      context: context,
      builder: (ctx) => ShadDialog(
        title: const Text('세션 삭제'),
        description: Text("'${session.title}' 세션을 삭제하시겠습니까?"),
        actions: [
          ShadButton.outline(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          ShadButton.destructive(
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
