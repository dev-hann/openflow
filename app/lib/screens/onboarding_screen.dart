import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/cubits/settings_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/utils/normalize_url.dart';
import 'package:openflow/widgets/provider_form.dart';

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
  bool _loading = false;
  String? _error;
  // ignore: use_late_for_private_fields_and_variables, document_ignores
  TokenPair? _tokens;

  @override
  void dispose() {
    _serverController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _submitServer() async {
    final url = normalizeUrl(_serverController.text);
    if (url.isEmpty) {
      setState(() => _error = '서버 주소를 입력해주세요');
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
    } on Object catch (e) {
      setState(() {
        _error = '서버에 연결할 수 없습니다: $e';
        _loading = false;
      });
    }
  }

  Future<void> _submitPin() async {
    final pin = _pinController.text.trim();
    if (pin.length != 6) {
      setState(() => _error = '6자리 PIN을 입력해주세요');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final url = context.read<SettingsCubit>().state.serverUrl!;
      final api = createApiClient(url);
      _tokens = await api.pairVerify(pin, 'mobile');

      final auth = StoredAuth(
        serverUrl: url,
        accessToken: _tokens!.accessToken,
        refreshToken: _tokens!.refreshToken,
        pairedAt: DateTime.now(),
      );
      if (!mounted) return;
      await context.read<AuthCubit>().saveAuth(auth);

      setState(() {
        _step = _Step.provider;
        _loading = false;
      });
    } on Object catch (e) {
      setState(() {
        _error = 'PIN 인증 실패: $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Spacing.lg),
          child: Column(
            children: [
              const SizedBox(height: Spacing.xxl),
              Icon(
                Icons.auto_awesome,
                size: 64,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: Spacing.lg),
              Text(
                'OpenFlow',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: Spacing.sm),
              Text(
                '개인 AI 비서',
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: Spacing.xxl),
              Expanded(child: _buildStep()),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: Spacing.md),
                  child: Text(
                    _error!,
                    style: TextStyle(color: theme.colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                ),
            ],
          ),
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
        Text('서버 주소 입력',
            style: Theme.of(context).textTheme.titleMedium,),
        const SizedBox(height: Spacing.md),
        TextField(
          controller: _serverController,
          decoration: const InputDecoration(
            hintText: '예: 192.168.1.100:3000',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.dns_outlined),
          ),
          keyboardType: TextInputType.url,
          onSubmitted: (_) => _submitServer(),
        ),
        const SizedBox(height: Spacing.lg),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
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
    return Column(
      children: [
        Text(
          'PIN 입력',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: Spacing.sm),
        Text(
          '서버 화면에 표시된 6자리 PIN을 입력하세요',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: Spacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(6, (i) {
            return Container(
              width: 44,
              height: 52,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                border: Border.all(
                  color: Theme.of(context).colorScheme.outline,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Text(
                i < _pinController.text.length
                    ? _pinController.text[i]
                    : '',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            );
          }),
        ),
        const SizedBox(height: Spacing.md),
        SizedBox(
          width: 200,
          child: TextField(
            controller: _pinController,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, letterSpacing: 8),
            decoration: const InputDecoration(
              counterText: '',
              border: InputBorder.none,
            ),
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _submitPin(),
          ),
        ),
        const SizedBox(height: Spacing.lg),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
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
