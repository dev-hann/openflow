import 'package:flutter/material.dart';

class ErrorBoundary extends StatefulWidget {
  const ErrorBoundary({
    required this.child,
    super.key,
    this.errorBuilder,
  });
  final Widget child;
  final Widget Function(FlutterErrorDetails)? errorBuilder;

  @override
  State<ErrorBoundary> createState() => _ErrorBoundaryState();
}

class _ErrorBoundaryState extends State<ErrorBoundary> {
  FlutterErrorDetails? _errorDetails;

  @override
  Widget build(BuildContext context) {
    if (_errorDetails != null) {
      if (widget.errorBuilder != null) {
        return widget.errorBuilder!(_errorDetails!);
      }
      return ErrorBanner(
        message: _errorDetails!.exceptionAsString(),
        onRetry: () => setState(() => _errorDetails = null),
      );
    }
    return widget.child;
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({
    required this.message,
    required this.onRetry,
    super.key,
  });
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline,
              color: theme.colorScheme.error,
              size: 32,
            ),
            const SizedBox(height: 8),
            Text(
              '오류가 발생했습니다',
              style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.onErrorContainer,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              message,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onErrorContainer,
              ),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            FilledButton.tonal(
              onPressed: onRetry,
              child: const Text('다시 시도'),
            ),
          ],
        ),
      ),
    );
  }
}
