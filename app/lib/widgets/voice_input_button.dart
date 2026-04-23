import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import 'package:speech_to_text/speech_to_text.dart' as stt;

class VoiceInputButton extends StatefulWidget {
  const VoiceInputButton({
    required this.onResult,
    super.key,
    this.enabled = true,
  });

  final ValueChanged<String> onResult;
  final bool enabled;

  @override
  State<VoiceInputButton> createState() => _VoiceInputButtonState();
}

class _VoiceInputButtonState extends State<VoiceInputButton> {
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isListening = false;
  bool _isAvailable = false;

  @override
  void initState() {
    super.initState();
    _initSpeech();
  }

  Future<void> _initSpeech() async {
    final available = await _speech.initialize(
      onError: (_) => _stopListening(),
      onStatus: (status) {
        if (status == 'notListening') {
          _stopListening();
        }
      },
    );
    if (mounted) {
      setState(() => _isAvailable = available);
    }
  }

  @override
  void dispose() {
    _speech.stop();
    super.dispose();
  }

  void _toggleListening() {
    if (!_isAvailable || !widget.enabled) return;
    if (_isListening) {
      _stopListening();
    } else {
      _startListening();
    }
  }

  Future<void> _startListening() async {
    setState(() => _isListening = true);
    final systemLocale = await _speech.systemLocale();
    await _speech.listen(
      onResult: (result) {
        if (result.finalResult) {
          widget.onResult(result.recognizedWords);
        }
      },
      localeId: systemLocale?.localeId ?? 'ko_KR',
    );
  }

  void _stopListening() {
    _speech.stop();
    if (mounted) {
      setState(() => _isListening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = ShadTheme.of(context).colorScheme;

    if (!_isAvailable) {
      return const SizedBox.shrink();
    }

    if (_isListening) {
      return _buildListeningIndicator(colorScheme);
    }

    return ShadIconButton.ghost(
      icon: Icon(LucideIcons.mic, size: 22, color: colorScheme.mutedForeground),
      onPressed: widget.enabled ? _toggleListening : null,
    );
  }

  Widget _buildListeningIndicator(ShadColorScheme colorScheme) {
    final destructive = colorScheme.destructive;
    return GestureDetector(
      onTap: _toggleListening,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: destructive.withValues(alpha: 0.15),
          shape: BoxShape.circle,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(3, (i) {
            return Container(
                  width: 3,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 1),
                  decoration: BoxDecoration(
                    color: destructive,
                    borderRadius: BorderRadius.circular(1.5),
                  ),
                )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .custom(
                  duration: 600.ms,
                  delay: (i * 120).ms,
                  builder: (context, value, child) {
                    return Container(
                      width: 3,
                      height: 8.0 + 16.0 * value,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(
                        color: destructive,
                        borderRadius: BorderRadius.circular(1.5),
                      ),
                    );
                  },
                );
          }),
        ),
      ),
    );
  }
}
