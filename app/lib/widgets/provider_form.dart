import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';

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
  bool _obscureApiKey = true;
  String? _savedProviderId;
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

  Future<ApiClient?> _getApi() async {
    final cubit = context.read<AuthCubit>();
    final token = await cubit.getValidToken();
    if (token == null || !mounted) return null;
    return createApiClient(cubit.state.storedAuth!.serverUrl, token: token);
  }

  void _setVerifyError(String error) {
    if (!mounted) return;
    setState(() {
      _verifying = false;
      _verifyResult = VerifyResult(ok: false, error: error);
    });
  }

  Future<void> _verify() async {
    final name = _nameController.text.trim();
    final baseUrl = normalizeUrl(_urlController.text);
    final apiKey = _apiKeyController.text.trim();
    if (name.isEmpty || baseUrl.isEmpty) return;
    setState(() { _verifying = true; _verifyResult = null; });

    try {
      final api = await _getApi();
      if (api == null) return;

      ProviderInfo provider;
      if (widget.editProvider != null) {
        final params = <String, dynamic>{'name': name, 'baseUrl': baseUrl};
        if (apiKey.isNotEmpty) params['apiKey'] = apiKey;
        provider = await api.updateProvider(widget.editProvider!.id, params);
      } else {
        if (apiKey.isEmpty) {
          _setVerifyError('API Key를 입력해주세요');
          return;
        }
        provider = await api.createProvider({
          'name': name,
          'baseUrl': baseUrl,
          'apiKey': apiKey,
          'model': '',
          'isDefault': true,
        });
      }

      _savedProviderId = provider.id;
      await api.verifyProvider(provider.id);
      final models = await api.fetchProviderModels(provider.id)..sort();
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _verifyResult = VerifyResult(ok: true, models: models);
        if (models.isNotEmpty && _selectedModel == null) {
          _selectedModel = models.first;
        }
      });
    } on Object catch (e) {
      _setVerifyError(e.toString());
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

    final api = await _getApi();
    if (api == null) return;
    setState(() => _submitting = true);

    try {
      await _persistProvider(api, name: name, baseUrl: baseUrl, apiKey: apiKey, model: model);
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

  Future<void> _persistProvider(
    ApiClient api, {
    required String name,
    required String baseUrl,
    required String apiKey,
    required String model,
  }) async {
    final cubit = context.read<ProvidersCubit>();
    if (_savedProviderId != null) {
      final updated = await api.updateProvider(_savedProviderId!, {'model': model});
      if (!mounted) return;
      if (widget.editProvider != null) {
        cubit.updateProvider(updated);
      } else {
        cubit.setProviders([...cubit.state.providers, updated]);
      }
    } else if (widget.editProvider != null) {
      final params = <String, dynamic>{'name': name, 'baseUrl': baseUrl, 'model': model};
      if (apiKey.isNotEmpty) params['apiKey'] = apiKey;
      final updated = await api.updateProvider(widget.editProvider!.id, params);
      if (!mounted) return;
      cubit.updateProvider(updated);
    } else {
      final provider = await api.createProvider({
        'name': name,
        'baseUrl': baseUrl,
        'apiKey': apiKey,
        'model': model,
        'isDefault': true,
      });
      if (!mounted) return;
      cubit.setProviders([...cubit.state.providers, provider]);
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
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureApiKey ? Icons.visibility_off : Icons.visibility,
                  ),
                  onPressed: () => setState(() => _obscureApiKey = !_obscureApiKey),
                ),
              ),
              obscureText: _obscureApiKey,
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
