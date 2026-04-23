import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/session_grouper.dart';
import 'package:openflow/widgets/app_list_tile.dart';
import 'package:openflow/widgets/session_tile.dart';
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
      child: _SessionSheetContent(
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

class _SessionSheetContent extends StatefulWidget {
  const _SessionSheetContent({
    required this.sessions,
    required this.activeSessionId,
    required this.onSessionTap,
    required this.onNewChat,
    required this.onSessionDelete,
    required this.onSettings,
  });

  final List<SessionInfo> sessions;
  final String? activeSessionId;
  final ValueChanged<String> onSessionTap;
  final VoidCallback onNewChat;
  final ValueChanged<String> onSessionDelete;
  final VoidCallback onSettings;

  @override
  State<_SessionSheetContent> createState() => _SessionSheetContentState();
}

class _SessionSheetContentState extends State<_SessionSheetContent> {
  String _searchQuery = '';
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  List<SessionInfo> get _filteredSessions {
    if (_searchQuery.isEmpty) return widget.sessions;
    final q = _searchQuery.toLowerCase();
    return widget.sessions
        .where((s) => s.title.toLowerCase().contains(q))
        .toList();
  }

  void _showSessionActions(SessionInfo session) {
    showShadSheet<void>(
      context: context,
      side: ShadSheetSide.bottom,
      builder: (ctx) => ShadSheet(
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppListTile(
                leading: Icon(
                  LucideIcons.trash2,
                  color: ShadTheme.of(context).colorScheme.destructive,
                ),
                title: const Text('세션 삭제'),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmDelete(session);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(SessionInfo session) async {
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
      widget.onSessionDelete(session.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSessions;
    final sorted = List<SessionInfo>.from(filtered)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final grouped = groupSessionsByDate(sorted);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildHandle(context),
        _buildHeader(context),
        _buildSearchField(context),
        const SizedBox(height: AppSpacing.xs),
        Flexible(child: _buildSessionList(context, sorted, grouped)),
        const ShadSeparator.horizontal(),
        AppListTile(
          leading: Icon(
            LucideIcons.settings,
            size: 20,
            color: ShadTheme.of(context).colorScheme.mutedForeground,
          ),
          title: const Text('설정'),
          onTap: widget.onSettings,
        ),
      ],
    );
  }

  Widget _buildHandle(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: Center(
        child: Container(
          width: 32,
          height: 4,
          decoration: BoxDecoration(
            color: ShadTheme.of(context).colorScheme.border,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final theme = ShadTheme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Row(
        children: [
          Text('대화', style: theme.textTheme.large),
          const Spacer(),
          ShadIconButton.ghost(
            onPressed: widget.onNewChat,
            icon: const Icon(LucideIcons.plus),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchField(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      child: ShadInput(
        onChanged: (v) => setState(() => _searchQuery = v),
        placeholder: const Text('검색...'),
        leading: Padding(
          padding: const EdgeInsets.only(left: AppSpacing.sm),
          child: Icon(
            LucideIcons.search,
            size: 20,
            color: ShadTheme.of(context).colorScheme.mutedForeground,
          ),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
    );
  }

  Widget _buildSessionList(
    BuildContext context,
    List<SessionInfo> sorted,
    Map<String, List<SessionInfo>> grouped,
  ) {
    final theme = ShadTheme.of(context);

    if (sorted.isEmpty) {
      return Center(
        child: Text(
          _searchQuery.isEmpty ? '대화가 없습니다' : '검색 결과가 없습니다',
          style: theme.textTheme.muted,
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      shrinkWrap: true,
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
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
