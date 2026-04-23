import 'package:flutter/widgets.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import 'package:equatable/equatable.dart';

import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/widgets/app_spinner.dart';

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
          const SizedBox(height: AppSpacing.sm),
          _VerifyResultBanner(result: widget.result!),
        ],
        if ((widget.result?.ok ?? false) &&
            widget.result!.models.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
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
    return ShadButton.secondary(
      onPressed: verifying ? null : onVerify,
      child: verifying
          ? const AppSpinner()
          : const Text('연결 확인'),
    );
  }
}

class _VerifyResultBanner extends StatelessWidget {
  const _VerifyResultBanner({required this.result});
  final VerifyResult result;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: result.ok ? colorScheme.secondary : colorScheme.destructive,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(
        result.ok ? '연결 성공!' : result.error ?? '연결 실패',
        style: TextStyle(
          color: result.ok
              ? colorScheme.foreground
              : colorScheme.destructiveForeground,
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
    final colorScheme = ShadTheme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '모델 선택',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: colorScheme.foreground,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        ShadInput(
          placeholder: const Text('모델 검색...'),
          leading: Padding(
            padding: const EdgeInsets.only(left: AppSpacing.sm),
            child: Icon(LucideIcons.search, size: 20, color: colorScheme.mutedForeground),
          ),
          onChanged: onSearchChanged,
        ),
        const SizedBox(height: AppSpacing.xs),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 200),
          child: SingleChildScrollView(
            child: Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: models
                  .where((m) => m.toLowerCase().contains(searchQuery))
                  .map((model) {
                final isSelected = model == selectedModel;
                return GestureDetector(
                  onTap: () => onSelectModel(model),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? colorScheme.primary
                          : colorScheme.secondary,
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: Text(
                      model,
                      style: TextStyle(
                        fontSize: 12,
                        color: isSelected
                            ? colorScheme.primaryForeground
                            : colorScheme.foreground,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }
}
