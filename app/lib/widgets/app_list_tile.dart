import 'package:flutter/widgets.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class AppListTile extends StatelessWidget {
  const AppListTile({
    required this.title,
    super.key,
    this.leading,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.onLongPress,
    this.padding,
    this.backgroundColor,
  });

  final Widget title;
  final Widget? leading;
  final Widget? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final EdgeInsetsGeometry? padding;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final effectivePadding =
        padding ??
        const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm + 2,
        );

    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      behavior: HitTestBehavior.opaque,
      child: Container(
        color: backgroundColor,
        padding: effectivePadding,
        child: Row(
          children: [
            if (leading != null) ...[
              leading!,
              const SizedBox(width: AppSpacing.md),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  DefaultTextStyle(
                    style: ShadTheme.of(context).textTheme.muted.copyWith(
                      color: ShadTheme.of(context).colorScheme.foreground,
                      fontSize: 14,
                    ),
                    child: title,
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    DefaultTextStyle(
                      style: ShadTheme.of(context).textTheme.muted,
                      child: subtitle!,
                    ),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: AppSpacing.sm),
              trailing!,
            ],
          ],
        ),
      ),
    );
  }
}
