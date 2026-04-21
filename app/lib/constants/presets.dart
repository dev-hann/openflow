import 'package:equatable/equatable.dart';

class ProviderPreset extends Equatable {
  const ProviderPreset({
    required this.id,
    required this.label,
    required this.hint,
    required this.baseUrl,
    required this.needsApiKey,
  });
  final String id;
  final String label;
  final String hint;
  final String baseUrl;
  final bool needsApiKey;

  @override
  List<Object?> get props => [id, label, hint, baseUrl, needsApiKey];
}

const kProviderPresets = <ProviderPreset>[
  ProviderPreset(
    id: 'zai-coding-global',
    label: 'ZAI Coding Plan',
    hint: '글로벌 엔드포인트',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'zai-coding-china',
    label: 'ZAI Coding Plan',
    hint: '중국 엔드포인트',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'zai-general-global',
    label: 'ZAI General',
    hint: '글로벌 엔드포인트',
    baseUrl: 'https://api.zai-general.com/v1',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'zai-general-china',
    label: 'ZAI General',
    hint: '중국 엔드포인트',
    baseUrl: 'https://api.zai-general.cn/v1',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'openai',
    label: 'OpenAI',
    hint: 'GPT-4, GPT-4o',
    baseUrl: 'https://api.openai.com/v1',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'anthropic',
    label: 'Anthropic',
    hint: 'Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'google',
    label: 'Google Gemini',
    hint: 'Gemini Pro',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'deepseek',
    label: 'DeepSeek',
    hint: 'DeepSeek V3/R1',
    baseUrl: 'https://api.deepseek.com/v1',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'groq',
    label: 'Groq',
    hint: '빠른 추론',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'openrouter',
    label: 'OpenRouter',
    hint: '멀티 모델',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsApiKey: true,
  ),
  ProviderPreset(
    id: 'ollama',
    label: 'Ollama',
    hint: '로컬 실행',
    baseUrl: 'http://localhost:11434/v1',
    needsApiKey: false,
  ),
  ProviderPreset(
    id: 'custom',
    label: '직접 입력',
    hint: 'OpenAI 호환 엔드포인트',
    baseUrl: '',
    needsApiKey: true,
  ),
];
