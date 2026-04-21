import 'dart:convert';

import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/constants/presets.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/utils/normalize_url.dart';
import 'package:openflow/widgets/verify_section.dart';

class ProviderForm extends StatefulWidget {
  const ProviderForm({
    required this.onComplete,
    super.key,
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
  bool _submitting = false;
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
      final base = url.replaceFirst(RegExp(r'/+$'), '');
      final response = await http
          .get(
            Uri.parse('$base/models'),
            headers: {'Authorization': 'Bearer ${_apiKeyController.text}'},
          )
          .timeout(const Duration(seconds: 10));

      if (!mounted) return;

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final data = json['data'] as List<dynamic>? ?? [];
        final models = (data
                .map((m) => (m as Map<String, dynamic>)['id'] as String)
                .toList())
          ..sort();
        setState(() {
          _verifying = false;
          _verifyResult = VerifyResult(ok: true, models: models);
          if (models.isNotEmpty && _selectedModel == null) {
            _selectedModel = models.first;
          }
        });
      } else {
        setState(() {
          _verifying = false;
          _verifyResult =
              VerifyResult(ok: false, error: 'HTTP ${response.statusCode}');
        });
      }
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _verifyResult = VerifyResult(ok: false, error: e.toString());
      });
    }
  }

  Future<void> _handleSubmit() async {
    final name = _nameController.text.trim();
    final baseUrl = normalizeUrl(_urlController.text);
    final apiKey = _apiKeyController.text.trim();
    final model = _selectedModel ?? '';

    if (name.isEmpty || baseUrl.isEmpty || model.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이름, URL, 모델은 필수입니다')),
      );
      return;
    }

    if (widget.editProvider == null && apiKey.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('API Key를 입력해주세요')),
      );
      return;
    }

    final authCubit = context.read<AuthCubit>();
    final token = await authCubit.getValidToken();
    if (token == null || !mounted) return;

    final api = createApiClient(authCubit.state.storedAuth!.serverUrl);

    setState(() => _submitting = true);

    try {
      if (widget.editProvider != null) {
        final params = <String, dynamic>{
          'name': name,
          'baseUrl': baseUrl,
          'model': model,
        };
        if (apiKey.isNotEmpty) params['apiKey'] = apiKey;

        final updated =
            await api.updateProvider(token, widget.editProvider!.id, params);
        if (mounted) {
          context.read<ProvidersCubit>().updateProvider(updated);
        }
      } else {
        final provider = await api.createProvider(token, {
          'name': name,
          'baseUrl': baseUrl,
          'apiKey': apiKey,
          'model': model,
          'isDefault': true,
        });
        if (mounted) {
          final cubit = context.read<ProvidersCubit>();
          cubit.setProviders([...cubit.state.providers, provider]);
        }
      }

      if (mounted) widget.onComplete();
    } on Object catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Provider 저장 실패: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
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
              decoration: InputDecoration(
                labelText: 'API Key',
                border: const OutlineInputBorder(),
                hintText: widget.editProvider != null ? '변경 시에만 입력' : null,
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
                onPressed: _submitting ? null : _handleSubmit,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(widget.editProvider != null ? '저장' : '완료'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
