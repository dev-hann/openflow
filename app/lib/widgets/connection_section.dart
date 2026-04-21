import 'package:flutter/material.dart';

import 'package:openflow/cubits/auth_cubit.dart';

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
    final theme = Theme.of(context);
    final connected = authState.isConnected;
    final url = authState.storedAuth?.serverUrl;

    return ListTile(
      leading: Icon(
        connected ? Icons.cloud_done_outlined : Icons.cloud_off_outlined,
        color: connected ? theme.colorScheme.tertiary : theme.colorScheme.error,
      ),
      title: Text(connected ? '연결됨' : '연결 안됨'),
      subtitle: url != null
          ? Text(url, style: theme.textTheme.bodySmall)
          : null,
      trailing: OutlinedButton(
        onPressed: onServerChanged,
        style: OutlinedButton.styleFrom(
          foregroundColor: theme.colorScheme.error,
          side: BorderSide(
            color: theme.colorScheme.error.withValues(alpha: 0.5),
          ),
        ),
        child: const Text('서버 변경'),
      ),
    );
  }
}
