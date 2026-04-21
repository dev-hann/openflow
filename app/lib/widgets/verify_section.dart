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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _VerifyButton(
          verifying: widget.verifying,
          onVerify: widget.onVerify,
        ),
        if (widget.result != null) ...[
          const SizedBox(height: Spacing.sm),
          _VerifyResultBanner(result: widget.result!),
        ],
        if ((widget.result?.ok ?? false) &&
            widget.result!.models.isNotEmpty) ...[
          const SizedBox(height: Spacing.sm),
          _ModelChipSelector(
            models: widget.result!.models,
            selectedModel: widget.selectedModel,
            searchQuery: _searchQuery,
            onSearchChanged: (v) =>
                setState(() => _searchQuery = v.toLowerCase()),
            onSelectModel: widget.onSelectModel,
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

class _VerifyButton extends StatelessWidget {
  const _VerifyButton({required this.verifying, required this.onVerify});
  final bool verifying;
  final VoidCallback onVerify;

  @override
  Widget build(BuildContext context) {
    return FilledButton.tonal(
      onPressed: verifying ? null : onVerify,
      child: verifying
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Text('연결 확인'),
    );
  }
}

class _VerifyResultBanner extends StatelessWidget {
  const _VerifyResultBanner({required this.result});
  final VerifyResult result;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: result.ok
            ? theme.colorScheme.primaryContainer
            : theme.colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(
        result.ok ? '연결 성공!' : result.error ?? '연결 실패',
        style: TextStyle(
          color: result.ok
              ? theme.colorScheme.onPrimaryContainer
              : theme.colorScheme.onErrorContainer,
        ),
      ),
    );
  }
}

class _ModelChipSelector extends StatelessWidget {
  const _ModelChipSelector({
    required this.models,
    required this.selectedModel,
    required this.searchQuery,
    required this.onSearchChanged,
    required this.onSelectModel,
  });
  final List<String> models;
  final String? selectedModel;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onSelectModel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('모델 선택', style: theme.textTheme.labelLarge),
        const SizedBox(height: Spacing.xs),
        TextFormField(
          decoration: const InputDecoration(
            hintText: '모델 검색...',
            prefixIcon: Icon(Icons.search),
            isDense: true,
            border: OutlineInputBorder(),
          ),
          onChanged: onSearchChanged,
        ),
        const SizedBox(height: Spacing.xs),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 200),
          child: SingleChildScrollView(
            child: Wrap(
              spacing: Spacing.xs,
              children: models
                  .where((m) => m.toLowerCase().contains(searchQuery))
                  .map((model) {
                return ChoiceChip(
                  label: Text(model),
                  selected: model == selectedModel,
                  onSelected: (_) => onSelectModel(model),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }
}
