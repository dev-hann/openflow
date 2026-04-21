import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/constants/presets.dart';

class PresetSelector extends StatelessWidget {
  const PresetSelector({
    required this.selectedPreset,
    required this.onSelected,
    super.key,
  });

  final ProviderPreset? selectedPreset;
  final ValueChanged<ProviderPreset> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('프리셋 선택', style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: Spacing.sm),
        Wrap(
          spacing: Spacing.xs,
          runSpacing: Spacing.xs,
          children: kProviderPresets.map((preset) {
            return ChoiceChip(
              label: Text(preset.label),
              selected: selectedPreset?.id == preset.id,
              onSelected: (_) => onSelected(preset),
            );
          }).toList(),
        ),
        const SizedBox(height: Spacing.lg),
      ],
    );
  }
}
