import 'dart:async';

import 'package:flutter/material.dart';

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

class _VoiceInputButtonState extends State<VoiceInputButton>
    with SingleTickerProviderStateMixin {
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isListening = false;
  bool _isAvailable = false;
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    );
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
    _controller.dispose();
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
    _controller.repeat(reverse: true);
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
    _controller.stop();
    if (mounted) {
      setState(() => _isListening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (!_isAvailable) {
      return const SizedBox.shrink();
    }

    if (_isListening) {
      return _buildListeningIndicator(theme);
    }

    return IconButton(
      icon: const Icon(Icons.mic_outlined, size: 22),
      tooltip: '음성 입력',
      color: theme.colorScheme.onSurfaceVariant,
      onPressed: widget.enabled ? _toggleListening : null,
    );
  }

  Widget _buildListeningIndicator(ThemeData theme) {
    return GestureDetector(
      onTap: _toggleListening,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: theme.colorScheme.errorContainer,
          shape: BoxShape.circle,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(3, (i) {
            return AnimatedBuilder(
              animation: _animation,
              builder: (context, child) {
                final offset = i * 0.2;
                final progress = (_animation.value + offset) % 1.0;
                final height = 8.0 + 16.0 * progress;
                return Container(
                  width: 3,
                  height: height,
                  margin: const EdgeInsets.symmetric(horizontal: 1),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.onErrorContainer,
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
