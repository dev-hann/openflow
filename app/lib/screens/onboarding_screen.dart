import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/settings_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/utils/normalize_url.dart';
import 'package:openflow/widgets/pin_input.dart';
import 'package:openflow/widgets/provider_form.dart';
import 'package:openflow/widgets/step_indicator.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({required this.onComplete, super.key});
  final VoidCallback onComplete;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  _Step _step = _Step.server;
  final _serverController = TextEditingController();
  final _pinController = TextEditingController();
  final _pinFocusNode = FocusNode();
  bool _loading = false;
  bool _isVerifying = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _pinController.addListener(() {
      if (_pinController.text.length == 6 && !_isVerifying) {
        _submitPin();
      }
    });
  }

  @override
  void dispose() {
    _serverController.dispose();
    _pinController.dispose();
    _pinFocusNode.dispose();
    super.dispose();
  }

  bool _isValidUrl(String url) {
    if (url.trim().isEmpty) return false;
    try {
      final uri = Uri.parse(url);
      return uri.hasScheme && uri.host.isNotEmpty;
    } on FormatException {
      return false;
    }
  }

  void _previousStep() {
    if (_step.index > 0) {
      setState(() => _step = _Step.values[_step.index - 1]);
    }
  }

  Future<void> _submitServer() async {
    final url = normalizeUrl(_serverController.text);
    if (url.isEmpty) {
      setState(() => _error = '서버 주소를 입력해주세요');
      return;
    }
    if (!_isValidUrl(url)) {
      setState(() => _error = '올바른 서버 주소를 입력해주세요');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = createApiClient(url);
      await api.pairInit();
      if (!mounted) return;
      context.read<SettingsCubit>().setServerUrl(url);
      setState(() {
        _step = _Step.pin;
        _loading = false;
      });
    } on Object {
      setState(() {
        _error = '서버에 연결할 수 없습니다.';
        _loading = false;
      });
    }
  }

  Future<void> _submitPin() async {
    if (_isVerifying || _loading) return;
    final pin = _pinController.text.trim();
    if (pin.length != 6) {
      setState(() => _error = '6자리 PIN을 입력해주세요');
      return;
    }

    setState(() {
      _loading = true;
      _isVerifying = true;
      _error = null;
    });

    try {
      final url = context.read<SettingsCubit>().state.serverUrl!;
      final api = createApiClient(url);
      final tokens = await api.pairVerify(pin, 'mobile');

      final auth = StoredAuth(
        serverUrl: url,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        pairedAt: DateTime.now(),
      );
      if (!mounted) return;
      await context.read<AuthCubit>().saveAuth(auth);

      setState(() {
        _step = _Step.provider;
        _loading = false;
        _isVerifying = false;
      });
    } on Object {
      setState(() {
        _error = 'PIN 인증에 실패했습니다.';
        _loading = false;
        _isVerifying = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _step.index > 0
          ? AppBar(
              leading: IconButton(
                icon: const Icon(LucideIcons.arrowLeft),
                onPressed: _previousStep,
              ),
            )
          : null,
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = ShadTheme.of(context).colorScheme;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            const SizedBox(height: AppSpacing.xxl),
            Icon(
              LucideIcons.sparkles,
              size: 64,
              color: colorScheme.primary,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'OpenFlow',
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '개인 AI 비서',
              style: theme.textTheme.bodyLarge?.copyWith(
                color: colorScheme.mutedForeground,
              ),
            ),
            const SizedBox(height: AppSpacing.xxl),
            StepIndicator(currentIndex: _step.index),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: _buildStep()),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.md),
                child: Text(
                  _error!,
                  style: TextStyle(color: colorScheme.destructive),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case _Step.server:
        return _buildServerStep();
      case _Step.pin:
        return _buildPinStep();
      case _Step.provider:
        return _buildProviderStep();
    }
  }

  Widget _buildServerStep() {
    return Column(
      children: [
        Text(
          '서버 주소 입력',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.md),
        ShadInput(
          controller: _serverController,
          placeholder: const Text('예: 192.168.1.100:3000'),
          leading: const Icon(LucideIcons.server),
          keyboardType: TextInputType.url,
          onSubmitted: (_) => _submitServer(),
        ),
        const SizedBox(height: AppSpacing.lg),
        SizedBox(
          width: double.infinity,
          child: ShadButton(
            onPressed: _loading ? null : _submitServer,
            child: _loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('연결'),
          ),
        ),
      ],
    );
  }

  Widget _buildPinStep() {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Column(
      children: [
        Text(
          'PIN 입력',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          '서버 화면에 표시된 6자리 PIN을 입력하세요',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.mutedForeground,
              ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.lg),
        PinInput(
          controller: _pinController,
          focusNode: _pinFocusNode,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: AppSpacing.lg),
        SizedBox(
          width: double.infinity,
          child: ShadButton(
            onPressed: _loading ? null : _submitPin,
            child: _loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('인증'),
          ),
        ),
      ],
    );
  }

  Widget _buildProviderStep() {
    return ProviderForm(
      showSkip: true,
      onComplete: widget.onComplete,
    );
  }
}

enum _Step { server, pin, provider }
