import 'package:flutter/widgets.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    required this.body,
    super.key,
    this.title,
    this.leading,
    this.actions,
    this.resizeToAvoidBottomInset = true,
  });

  final Widget body;
  final String? title;
  final Widget? leading;
  final List<Widget>? actions;
  final bool resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    final viewInsets = MediaQuery.of(context).viewInsets;

    return ColoredBox(
      color: colorScheme.background,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: resizeToAvoidBottomInset ? viewInsets.bottom : 0,
        ),
        child: SafeArea(
          child: Column(
            children: [
              if (title != null || leading != null || actions != null)
                _AppBar(title: title, leading: leading, actions: actions),
              Expanded(child: body),
            ],
          ),
        ),
      ),
    );
  }
}

class _AppBar extends StatelessWidget {
  const _AppBar({this.title, this.leading, this.actions});

  final String? title;
  final Widget? leading;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    final padding = MediaQuery.of(context).padding;

    return Container(
      height: 56 + padding.top,
      padding: EdgeInsets.only(top: padding.top),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: colorScheme.border, width: 0.5),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
        child: Row(
          children: [
            if (leading != null)
              leading!
            else
              const SizedBox(width: AppSpacing.md),
            Expanded(
              child: title != null
                  ? Text(
                      title!,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: colorScheme.foreground,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    )
                  : const SizedBox.shrink(),
            ),
            if (actions != null) ...actions!,
          ],
        ),
      ),
    );
  }
}
