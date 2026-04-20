import 'package:flutter/material.dart';
import 'package:openflow/constants/dimensions.dart';

class ConnectionSection extends StatelessWidget {

  const ConnectionSection({
    required this.isConnected, required this.onServerChanged, super.key,
    this.serverUrl,
  });
  final bool isConnected;
  final String? serverUrl;
  final VoidCallback onServerChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isConnected
                        ? theme.colorScheme.tertiary
                        : theme.colorScheme.error,
                  ),
                ),
                const SizedBox(width: Spacing.sm),
                Text(
                  isConnected ? '연결됨' : '연결 안됨',
                  style: theme.textTheme.titleSmall,
                ),
              ],
            ),
            if (serverUrl != null) ...[
              const SizedBox(height: Spacing.xs),
              Text(
                serverUrl!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            const SizedBox(height: Spacing.md),
            OutlinedButton(
              onPressed: onServerChanged,
              child: const Text('서버 변경'),
            ),
          ],
        ),
      ),
    );
  }
}
