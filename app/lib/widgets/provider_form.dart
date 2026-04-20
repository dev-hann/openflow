import 'package:flutter/material.dart';
import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/constants/presets.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/normalize_url.dart';
import 'package:openflow/widgets/verify_section.dart';

class ProviderForm extends StatefulWidget {

  const ProviderForm({
    required this.onComplete, super.key,
    this.showSkip = false,
    this.editProvider,
  });
  final VoidCallback onComplete;
  final bool showSkip;
  final ProviderInfo? editProvider;

  @override
  State<ProviderForm> createState() => _ProviderFormState();
}

class _ProviderFormState extends State<ProviderForm> {
  final _nameController = TextEditingController();
  final _urlController = TextEditingController();
  final _apiKeyController = TextEditingController();
  ProviderPreset? _selectedPreset;
  String? _selectedModel;
  bool _verifying = false;
  VerifyResult? _verifyResult;

  @override
  void initState() {
    super.initState();
    if (widget.editProvider != null) {
      final p = widget.editProvider!;
      _nameController.text = p.name;
      _urlController.text = p.baseUrl;
      _selectedModel = p.model.isNotEmpty ? p.model : null;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _urlController.dispose();
    _apiKeyController.dispose();
    super.dispose();
  }

  void _selectPreset(ProviderPreset preset) {
    setState(() {
      _selectedPreset = preset;
      if (preset.id != 'custom') {
        _nameController.text = preset.label;
        _urlController.text = preset.baseUrl;
      }
      _verifyResult = null;
      _selectedModel = null;
    });
  }

  Future<void> _verify() async {
    final url = normalizeUrl(_urlController.text);
    if (url.isEmpty) return;

    setState(() {
      _verifying = true;
      _verifyResult = null;
    });

    try {
      final response = await HttpClientProvider.verify(
        url,
        _apiKeyController.text,
      );
      setState(() {
        _verifying = false;
        _verifyResult = VerifyResult(
          ok: true,
          models: response,
        );
        if (response.isNotEmpty && _selectedModel == null) {
          _selectedModel = response.first;
        }
      });
    } on Object catch (e) {
      setState(() {
        _verifying = false;
        _verifyResult = VerifyResult(ok: false, error: e.toString());
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(Spacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.editProvider == null) ...[
            Text('프리셋 선택', style: theme.textTheme.labelLarge),
            const SizedBox(height: Spacing.sm),
            Wrap(
              spacing: Spacing.xs,
              runSpacing: Spacing.xs,
              children: kProviderPresets.map((preset) {
                final selected = _selectedPreset?.id == preset.id;
                return ChoiceChip(
                  label: Text(preset.label),
                  selected: selected,
                  onSelected: (_) => _selectPreset(preset),
                );
              }).toList(),
            ),
            const SizedBox(height: Spacing.lg),
          ],
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: '이름',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: Spacing.md),
          TextField(
            controller: _urlController,
            decoration: const InputDecoration(
              labelText: 'Base URL',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.url,
          ),
          if (_selectedPreset?.needsApiKey ?? true) ...[
            const SizedBox(height: Spacing.md),
            TextField(
              controller: _apiKeyController,
              decoration: const InputDecoration(
                labelText: 'API Key',
                border: OutlineInputBorder(),
              ),
              obscureText: true,
            ),
          ],
          const SizedBox(height: Spacing.lg),
          VerifySection(
            verifying: _verifying,
            result: _verifyResult,
            selectedModel: _selectedModel,
            onVerify: _verify,
            onSelectModel: (model) => setState(() => _selectedModel = model),
          ),
          const SizedBox(height: Spacing.lg),
          Row(
            children: [
              if (widget.showSkip)
                TextButton(
                  onPressed: widget.onComplete,
                  child: const Text('건너뛰기'),
                ),
              const Spacer(),
              FilledButton(
                onPressed: _handleSubmit,
                child: Text(widget.editProvider != null ? '저장' : '완료'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _handleSubmit() {
    widget.onComplete();
  }
}

class HttpClientProvider {
  static Future<List<String>> verify(String url, String apiKey) async {
    // Placeholder - actual implementation in screen
    return [];
  }
}
