import 'package:flutter/widgets.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/widgets/app_list_tile.dart';

class ConnectionSection extends StatelessWidget {
  const ConnectionSection({
    required this.authState,
    required this.onServerChanged,
    super.key,
  });

  final AuthState authState;
  final VoidCallback onServerChanged;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    final connected = authState.isConnected;
    final url = authState.storedAuth?.serverUrl;

    return AppListTile(
      leading: Icon(
        connected ? LucideIcons.cloud : LucideIcons.cloudOff,
        color: connected ? AppColors.success : colorScheme.destructive,
      ),
      title: Text(connected ? '연결됨' : '연결 안됨'),
      subtitle: url != null
          ? Text(
              url,
              style: TextStyle(
                fontSize: 12,
                color: colorScheme.mutedForeground,
              ),
            )
          : null,
      trailing: ShadButton.outline(
        onPressed: onServerChanged,
        child: Text('서버 변경', style: TextStyle(color: colorScheme.destructive)),
      ),
    );
  }
}
