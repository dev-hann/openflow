import 'package:flutter/material.dart';
import '../constants/dimensions.dart';

class ModelSection extends StatelessWidget {
  final String? currentModel;
  final List<String> availableModels;
  final ValueChanged<String> onModelChange;

  const ModelSection({
    super.key,
    this.currentModel,
    required this.availableModels,
    required this.onModelChange,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(Spacing.md),
          child: Text('모델 선택', style: theme.textTheme.titleMedium),
        ),
        const Divider(height: 1),
        if (availableModels.isEmpty)
          const Padding(
            padding: EdgeInsets.all(Spacing.xl),
            child: Text('사용 가능한 모델이 없습니다'),
          ),
        Flexible(
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: availableModels.length,
            itemBuilder: (context, index) {
              final model = availableModels[index];
              final isActive = model == currentModel;
              return ListTile(
                leading: Icon(
                  isActive ? Icons.check_circle : Icons.circle_outlined,
                  color: isActive ? theme.colorScheme.primary : null,
                ),
                title: Text(model),
                onTap: () {
                  onModelChange(model);
                  Navigator.pop(context);
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
