import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';

class ModelSheet extends StatelessWidget {
  const ModelSheet({
    required this.providerName,
    required this.models,
    required this.currentModel,
    super.key,
  });

  final String providerName;
  final List<String> models;
  final String currentModel;

  static Future<String?> show({
    required BuildContext context,
    required String providerName,
    required List<String> models,
    required String currentModel,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => ModelSheet(
        providerName: providerName,
        models: models,
        currentModel: currentModel,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              Spacing.md,
              Spacing.md,
              Spacing.md,
              Spacing.sm,
            ),
            child: Row(
              children: [
                Text(
                  '$providerName 모델',
                  style: theme.textTheme.titleMedium,
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (models.isEmpty)
            const Padding(
              padding: EdgeInsets.all(Spacing.xl),
              child: Text('사용 가능한 모델이 없습니다'),
            ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: models.length,
              itemBuilder: (context, index) {
                final model = models[index];
                final isActive = model == currentModel;
                return ListTile(
                  leading: Icon(
                    isActive
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: isActive ? theme.colorScheme.primary : null,
                  ),
                  title: Text(
                    model,
                    style: isActive
                        ? TextStyle(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w600,
                          )
                        : null,
                  ),
                  trailing: isActive
                      ? Text(
                          '사용 중',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.primary,
                          ),
                        )
                      : null,
                  onTap: () => Navigator.of(context).pop(model),
                );
              },
            ),
          ),
          const SizedBox(height: Spacing.md),
        ],
      ),
    );
  }
}
