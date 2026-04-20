import 'package:flutter/material.dart';

class ErrorBoundary extends StatelessWidget {

  const ErrorBoundary({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return child;
  }
}

class ErrorBanner extends StatelessWidget {

  const ErrorBanner({
    required this.details, required this.onRetry, super.key,
  });
  final FlutterErrorDetails details;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48),
          const SizedBox(height: 16),
          Text('오류가 발생했습니다', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          FilledButton.tonal(onPressed: onRetry, child: const Text('다시 시도')),
        ],
      ),
    );
  }
}
