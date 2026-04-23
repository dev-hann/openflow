import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:openflow/services/api_client.dart';
import 'package:package_info_plus/package_info_plus.dart';

class ErrorReporter {
  ErrorReporter._(this._apiClient, this._version);
  final ApiClient _apiClient;
  final String _version;
  bool _initialized = false;

  static Future<ErrorReporter> init(ApiClient apiClient) async {
    final info = await PackageInfo.fromPlatform();
    final reporter = ErrorReporter._(apiClient, info.version);
    reporter._setup();
    return reporter;
  }

  void _setup() {
    if (_initialized) return;
    _initialized = true;

    FlutterError.onError = (FlutterErrorDetails details) {
      FlutterError.presentError(details);
      _report(
        errorCode: 'FLUTTER_ERROR',
        message: details.exceptionAsString(),
        stackTrace: details.stack?.toString(),
      );
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      _report(
        errorCode: 'PLATFORM_ERROR',
        message: error.toString(),
        stackTrace: stack.toString(),
      );
      return true;
    };
  }

  void _report({
    required String errorCode,
    required String message,
    String? stackTrace,
  }) {
    _apiClient
        .reportError(
          platform: 'app',
          version: _version,
          errorCode: errorCode,
          message: message,
          stackTrace: stackTrace,
        )
        .catchError((_) {});
  }
}
