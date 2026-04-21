import 'package:flutter/material.dart';

import 'package:equatable/equatable.dart';

import 'package:openflow/constants/dimensions.dart';

class VerifySection extends StatefulWidget {
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
  State<VerifySection> createState() => _VerifySectionState();
}

class _VerifySectionState extends State<VerifySection> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FilledButton.tonal(
          onPressed: widget.verifying ? null : widget.onVerify,
          child: widget.verifying
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('연결 확인'),
        ),
        if (widget.result != null) ...[
          const SizedBox(height: Spacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(Spacing.md),
            decoration: BoxDecoration(
              color: widget.result!.ok
                  ? theme.colorScheme.primaryContainer
                  : theme.colorScheme.errorContainer,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Text(
              widget.result!.ok
                  ? '연결 성공!'
                  : widget.result!.error ?? '연결 실패',
              style: TextStyle(
                color: widget.result!.ok
                    ? theme.colorScheme.onPrimaryContainer
                    : theme.colorScheme.onErrorContainer,
              ),
            ),
          ),
        ],
        if ((widget.result?.ok ?? false) &&
            widget.result!.models.isNotEmpty) ...[
          const SizedBox(height: Spacing.sm),
          Text('모델 선택', style: theme.textTheme.labelLarge),
          const SizedBox(height: Spacing.xs),
          TextFormField(
            decoration: const InputDecoration(
              hintText: '모델 검색...',
              prefixIcon: Icon(Icons.search),
              isDense: true,
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
          ),
          const SizedBox(height: Spacing.xs),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 200),
            child: SingleChildScrollView(
              child: Wrap(
                spacing: Spacing.xs,
                children: widget.result!.models
                    .where((m) => m.toLowerCase().contains(_searchQuery))
                    .map((model) {
                  final selected = model == widget.selectedModel;
                  return ChoiceChip(
                    label: Text(model),
                    selected: selected,
                    onSelected: (_) => widget.onSelectModel(model),
                  );
                }).toList(),
              ),
            ),
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
