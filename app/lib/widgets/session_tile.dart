import 'package:flutter/widgets.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/format_time.dart';
import 'package:openflow/widgets/app_list_tile.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class SessionGroupHeader extends StatelessWidget {
  const SessionGroupHeader({required this.label, super.key});
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: Text(
        label,
        style: theme.textTheme.muted.copyWith(fontWeight: FontWeight.w600),
      ),
    );
  }
}

class SessionTile extends StatelessWidget {
  const SessionTile({
    required this.session,
    required this.isActive,
    required this.onTap,
    required this.onLongPress,
    super.key,
  });
  final SessionInfo session;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    return AppListTile(
      backgroundColor: isActive
          ? theme.colorScheme.primary.withValues(alpha: 0.1)
          : null,
      leading: Icon(
        LucideIcons.messageSquare,
        size: 20,
        color: theme.colorScheme.mutedForeground,
      ),
      title: Text(session.title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(formatRelativeTime(session.createdAt)),
      trailing: isActive
          ? Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
                shape: BoxShape.circle,
              ),
            )
          : null,
      onTap: onTap,
      onLongPress: onLongPress,
    );
  }
}
