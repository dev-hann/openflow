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
          _SheetHeader(title: '$providerName 모델', theme: theme),
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
              itemBuilder: (context, index) => _ModelListTile(
                model: models[index],
                isActive: models[index] == currentModel,
                theme: theme,
              ),
            ),
          ),
          const SizedBox(height: Spacing.md),
        ],
      ),
    );
  }
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.title, required this.theme});
  final String title;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          Spacing.md, Spacing.md, Spacing.md, Spacing.sm),
      child: Row(
        children: [
          Text(title, style: theme.textTheme.titleMedium),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }
}

class _ModelListTile extends StatelessWidget {
  const _ModelListTile({
    required this.model,
    required this.isActive,
    required this.theme,
  });
  final String model;
  final bool isActive;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(
        isActive ? Icons.radio_button_checked : Icons.radio_button_unchecked,
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
  }
}
