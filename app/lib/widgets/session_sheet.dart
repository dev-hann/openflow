import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/session_grouper.dart';
import 'package:openflow/widgets/session_tile.dart';

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
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => SessionSheet(
        sessions: sessions,
        activeSessionId: activeSessionId,
        onSessionTap: onSessionTap,
        onNewChat: onNewChat,
        onSessionDelete: onSessionDelete,
        onSettings: onSettings,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return _SessionSheetContent(
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
          onSessionDelete: onSessionDelete,
          onSettings: () {
            Navigator.of(context).pop();
            onSettings();
          },
          scrollController: scrollController,
        );
      },
    );
  }
}

class _SessionSheetContent extends StatefulWidget {
  const _SessionSheetContent({
    required this.sessions,
    required this.activeSessionId,
    required this.onSessionTap,
    required this.onNewChat,
    required this.onSessionDelete,
    required this.onSettings,
    required this.scrollController,
  });

  final List<SessionInfo> sessions;
  final String? activeSessionId;
  final ValueChanged<String> onSessionTap;
  final VoidCallback onNewChat;
  final ValueChanged<String> onSessionDelete;
  final VoidCallback onSettings;
  final ScrollController scrollController;

  @override
  State<_SessionSheetContent> createState() => _SessionSheetContentState();
}

class _SessionSheetContentState extends State<_SessionSheetContent> {
  String _searchQuery = '';

  List<SessionInfo> get _filteredSessions {
    if (_searchQuery.isEmpty) return widget.sessions;
    final q = _searchQuery.toLowerCase();
    return widget.sessions
        .where((s) => s.title.toLowerCase().contains(q))
        .toList();
  }

  void _showSessionActions(SessionInfo session) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('세션 삭제'),
              onTap: () {
                Navigator.pop(ctx);
                widget.onSessionDelete(session.id);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSessions;
    final sorted = List<SessionInfo>.from(filtered)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final grouped = groupSessionsByDate(sorted);

    return Column(
      children: [
        _buildHandle(context),
        _buildHeader(context),
        _buildSearchField(context),
        const SizedBox(height: Spacing.xs),
        Expanded(
          child: _buildSessionList(context, sorted, grouped),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.settings_outlined),
          title: const Text('설정'),
          onTap: widget.onSettings,
        ),
      ],
    );
  }

  Widget _buildHandle(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Spacing.md,
        Spacing.sm,
        Spacing.md,
        Spacing.xs,
      ),
      child: Center(
        child: Container(
          width: 32,
          height: 4,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.outlineVariant,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
      child: Row(
        children: [
          Text('대화', style: Theme.of(context).textTheme.titleLarge),
          const Spacer(),
          IconButton(
            onPressed: widget.onNewChat,
            icon: const Icon(Icons.add),
            tooltip: '새 대화',
          ),
        ],
      ),
    );
  }

  Widget _buildSearchField(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: Spacing.md,
        vertical: Spacing.xs,
      ),
      child: TextField(
        onChanged: (v) => setState(() => _searchQuery = v),
        decoration: InputDecoration(
          hintText: '검색...',
          prefixIcon: const Icon(Icons.search, size: 20),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: Spacing.md,
            vertical: Spacing.sm,
          ),
          isDense: true,
        ),
      ),
    );
  }

  Widget _buildSessionList(
    BuildContext context,
    List<SessionInfo> sorted,
    Map<String, List<SessionInfo>> grouped,
  ) {
    final theme = Theme.of(context);

    if (sorted.isEmpty) {
      return Center(
        child: Text(
          _searchQuery.isEmpty ? '대화가 없습니다' : '검색 결과가 없습니다',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      );
    }

    return ListView.builder(
      controller: widget.scrollController,
      padding: const EdgeInsets.only(bottom: Spacing.xl),
      itemCount: grouped.entries.fold<int>(
        0,
        (sum, e) => sum + 1 + e.value.length,
      ),
      itemBuilder: (context, index) {
        var currentIndex = index;
        for (final entry in grouped.entries) {
          if (currentIndex == 0) {
            return SessionGroupHeader(label: entry.key);
          }
          currentIndex--;
          if (currentIndex < entry.value.length) {
            final session = entry.value[currentIndex];
            return SessionTile(
              session: session,
              isActive: session.id == widget.activeSessionId,
              onTap: () => widget.onSessionTap(session.id),
              onLongPress: () => _showSessionActions(session),
            );
          }
          currentIndex -= entry.value.length;
        }
        return const SizedBox.shrink();
      },
    );
  }
}
