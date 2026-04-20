import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

import 'package:openflow/constants/dimensions.dart';

class VerifySection extends StatelessWidget {
  const VerifySection({
    required this.verifying,
    required this.onVerify,
    required this.onSelectModel,
    super.key,
    this.result,
    this.selectedModel,
  });
  final bool verifying;
  final VerifyResult? result;
  final String? selectedModel;
  final VoidCallback onVerify;
  final ValueChanged<String> onSelectModel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FilledButton.tonal(
          onPressed: verifying ? null : onVerify,
          child: verifying
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('연결 확인'),
        ),
        if (result != null) ...[
          const SizedBox(height: Spacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(Spacing.md),
            decoration: BoxDecoration(
              color: result!.ok
                  ? theme.colorScheme.primaryContainer
                  : theme.colorScheme.errorContainer,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Text(
              result!.ok ? '연결 성공!' : result!.error ?? '연결 실패',
              style: TextStyle(
                color: result!.ok
                    ? theme.colorScheme.onPrimaryContainer
                    : theme.colorScheme.onErrorContainer,
              ),
            ),
          ),
        ],
        if (result?.ok == true && result!.models.isNotEmpty) ...[
          const SizedBox(height: Spacing.sm),
          Text('모델 선택', style: theme.textTheme.labelLarge),
          const SizedBox(height: Spacing.xs),
          Wrap(
            spacing: Spacing.xs,
            children: result!.models.map((model) {
              final selected = model == selectedModel;
              return ChoiceChip(
                label: Text(model),
                selected: selected,
                onSelected: (_) => onSelectModel(model),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

class VerifyResult extends Equatable {
  const VerifyResult({
    required this.ok,
    this.models = const [],
    this.error,
  });
  final bool ok;
  final List<String> models;
  final String? error;

  @override
  List<Object?> get props => [ok, models, error];
}
