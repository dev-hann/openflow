import 'package:flutter/material.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

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
    return showShadSheet<String>(
      context: context,
      side: ShadSheetSide.bottom,
      builder: (_) => ModelSheet(
        providerName: providerName,
        models: models,
        currentModel: currentModel,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ShadSheet(
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _SheetHeader(title: '$providerName 모델'),
            const ShadSeparator.horizontal(),
            if (models.isEmpty)
              const Padding(
                padding: EdgeInsets.all(AppSpacing.xl),
                child: Text('사용 가능한 모델이 없습니다'),
              ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: models.length,
                itemBuilder: (context, index) => _ModelListTile(
                  model: models[index],
                  isActive: models[index] == currentModel,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.sm),
      child: Row(
        children: [
          Text(title, style: theme.textTheme.large),
          const Spacer(),
          ShadIconButton.ghost(
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
  });
  final String model;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
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
              style: theme.textTheme.muted.copyWith(
                color: theme.colorScheme.primary,
              ),
            )
          : null,
      onTap: () => Navigator.of(context).pop(model),
    );
  }
}
