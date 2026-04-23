import 'package:flutter/widgets.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/widgets/app_list_tile.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class ModelSheet extends StatefulWidget {
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
  State<ModelSheet> createState() => _ModelSheetState();
}

class _ModelSheetState extends State<ModelSheet> {
  String _searchQuery = '';

  List<String> get _filtered {
    if (_searchQuery.isEmpty) return widget.models;
    final q = _searchQuery.toLowerCase();
    return widget.models.where((m) => m.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    final filtered = _filtered;

    return ShadSheet(
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Text(
                    '${widget.providerName} 모델',
                    style: theme.textTheme.large,
                  ),
                ],
              ),
            ),
            if (widget.models.length > 10)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                ),
                child: ShadInput(
                  placeholder: const Text('모델 검색...'),
                  leading: Padding(
                    padding: const EdgeInsets.only(left: AppSpacing.sm),
                    child: Icon(
                      LucideIcons.search,
                      size: 20,
                      color: theme.colorScheme.mutedForeground,
                    ),
                  ),
                  onChanged: (v) =>
                      setState(() => _searchQuery = v.toLowerCase()),
                ),
              ),
            const ShadSeparator.horizontal(),
            if (widget.models.isEmpty)
              Semantics(
                label: '사용 가능한 모델이 없습니다',
                child: const Padding(
                  padding: EdgeInsets.all(AppSpacing.xl),
                  child: Text('사용 가능한 모델이 없습니다'),
                ),
              )
            else if (filtered.isEmpty)
              const Padding(
                padding: EdgeInsets.all(AppSpacing.xl),
                child: Text('검색 결과가 없습니다'),
              ),
            if (filtered.isNotEmpty)
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: filtered.length,
                  itemBuilder: (context, index) => _ModelListTile(
                    model: filtered[index],
                    isActive: filtered[index] == widget.currentModel,
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

class _ModelListTile extends StatelessWidget {
  const _ModelListTile({required this.model, required this.isActive});
  final String model;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    return Semantics(
      button: true,
      label: '$model${isActive ? ', 현재 모델' : ''}',
      child: AppListTile(
        leading: Icon(
          isActive ? LucideIcons.circleDot : LucideIcons.circle,
          size: 20,
          color: isActive
              ? theme.colorScheme.primary
              : theme.colorScheme.mutedForeground,
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
      ),
    );
  }
}
