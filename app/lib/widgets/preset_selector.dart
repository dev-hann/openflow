import 'package:animated_toggle_switch/animated_toggle_switch.dart';
import 'package:flutter/material.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/constants/presets.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

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
    final colorScheme = ShadTheme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '프리셋 선택',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: colorScheme.foreground,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AnimatedToggleSwitch<ProviderPreset>.rolling(
          current: selectedPreset ?? kProviderPresets.first,
          values: kProviderPresets,
          onChanged: onSelected,
          iconBuilder: (preset, foreground) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Text(
              preset.label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: foreground
                    ? colorScheme.primaryForeground
                    : colorScheme.foreground,
              ),
            ),
          ),
          style: ToggleStyle(
            backgroundColor: colorScheme.secondary,
            indicatorColor: colorScheme.primary,
            borderColor: Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          height: 36,
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}
