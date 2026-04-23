import 'dart:async';
import 'dart:convert';

import 'package:equatable/equatable.dart';
import 'package:http/http.dart' as http;

import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/normalize_url.dart';

class ApiException extends Equatable implements Exception {
  const ApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';

  @override
  List<Object?> get props => [statusCode, message];
}

class ApiError extends Equatable implements Exception {
  const ApiError(
      {required this.status, required this.code, required this.message});
  final int status;
  final String code;
  final String message;

  @override
  String toString() => 'ApiError($status $code): $message';

  @override
  List<Object?> get props => [status, code, message];
}

class MessageListResult extends Equatable {
  const MessageListResult({required this.messages, required this.total});
  final List<ChatMessage> messages;
  final int total;

  @override
  List<Object?> get props => [messages, total];
}

class ApiClient {
  ApiClient._(this._baseUrl, this._token, this._client);
  final String _baseUrl;
  final String? _token;
  final http.Client _client;
  static const _timeout = Duration(seconds: 15);

  void dispose() {
    _client.close();
  }

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> _get(String path) async {
    final response =
        await _client.get(_uri(path), headers: _headers()).timeout(_timeout);
    return _parse(response);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _client
        .post(_uri(path), headers: _headers(), body: jsonEncode(body))
        .timeout(_timeout);
    return _parse(response);
  }

  Future<Map<String, dynamic>> _put(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _client
        .put(_uri(path), headers: _headers(), body: jsonEncode(body))
        .timeout(_timeout);
    return _parse(response);
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    final response =
        await _client.delete(_uri(path), headers: _headers()).timeout(_timeout);
    return _parse(response);
  }

  Map<String, dynamic> _parse(http.Response response) {
    if (response.statusCode >= 400) {
      try {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        if (json.containsKey('error') && json['error'] is Map) {
          final err = json['error'] as Map<String, dynamic>;
          throw ApiError(
            status: response.statusCode,
            code: err['code'] as String? ?? 'UNKNOWN',
            message: err['message'] as String? ?? response.body,
          );
        }
        if (json.containsKey('message')) {
          throw ApiException(
            response.statusCode,
            json['message'] as String? ?? response.body,
          );
        }
      } on ApiError {
        rethrow;
      } on ApiException {
        rethrow;
      } on Object {
        // fall through to raw body handling
      }
      final message = response.body.length > 200
          ? response.body.substring(0, 200)
          : response.body;
      throw ApiException(response.statusCode, message);
    }
    try {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } on FormatException {
      throw ApiException(response.statusCode, response.body);
    }
  }

  Future<Map<String, dynamic>> pairInit() => _post('/api/auth/pair/init', {});

  Future<TokenPair> pairVerify(String pin, String label) async {
    final json = await _post('/api/auth/pair/verify', {
      'pin': pin,
      'label': label,
    });
    return TokenPair.fromJson(json);
  }

  Future<TokenPair> refreshToken(String refreshToken) async {
    final json = await _post('/api/auth/refresh', {
      'refreshToken': refreshToken,
    });
    return TokenPair.fromJson(json);
  }

  Future<void> unpair() async {
    await _delete('/api/auth/unpair');
  }

  Future<List<SessionInfo>> listSessions() async {
    final json = await _get('/api/sessions');
    final list = json['sessions'] as List<dynamic>;
    return list
        .map((e) => SessionInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<SessionInfo> createSession([String? title]) async {
    final json = await _post(
      '/api/sessions',
      {
        if (title != null) 'title': title,
      },
    );
    return SessionInfo.fromJson(json);
  }

  Future<void> deleteSession(String sessionId) async {
    await _delete('/api/sessions/$sessionId');
  }

  Future<MessageListResult> fetchMessages(
    String sessionId, {
    int limit = 50,
    int offset = 0,
  }) async {
    final uri = _uri('/api/sessions/$sessionId/messages').replace(
      queryParameters: {'limit': '$limit', 'offset': '$offset'},
    );
    final response =
        await _client.get(uri, headers: _headers()).timeout(_timeout);
    final json = _parse(response);
    final list = json['messages'] as List<dynamic>;
    final messages = <ChatMessage>[];
    for (var i = 0; i < list.length; i++) {
      final e = list[i] as Map<String, dynamic>;
      messages.add(ChatMessage(
        id: e['id']?.toString() ?? '${sessionId}_${e['createdAt']}_$i',
        role: e['role'] == 'user' ? MessageRole.user : MessageRole.assistant,
        content: e['content'] as String? ?? '',
        timestamp: DateTime.fromMillisecondsSinceEpoch(
          (e['createdAt'] as num?)?.toInt() ?? 0,
        ),
      ));
    }
    return MessageListResult(
      messages: messages,
      total: json['total'] as int? ?? messages.length,
    );
  }

  Future<Map<String, dynamic>> getStatus() => _get('/api/status');

  Future<List<ProviderInfo>> listProviders() async {
    final json = await _get('/api/providers');
    final list = json['providers'] as List<dynamic>;
    return list
        .map((e) => ProviderInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ProviderInfo> createProvider(Map<String, dynamic> params) async {
    final json = await _post('/api/providers', params);
    return ProviderInfo.fromJson(json);
  }

  Future<ProviderInfo> updateProvider(
    String id,
    Map<String, dynamic> params,
  ) async {
    final json = await _put('/api/providers/$id', params);
    return ProviderInfo.fromJson(json);
  }

  Future<void> deleteProvider(String id) async {
    await _delete('/api/providers/$id');
  }

  Future<Map<String, dynamic>> verifyProvider(String id) async {
    return _post('/api/providers/$id/verify', {});
  }

  Future<List<String>> fetchProviderModels(String id) async {
    final json = await _get('/api/providers/$id/models');
    final list = json['models'] as List<dynamic>;
    return list.map((e) => e as String).toList();
  }

  Future<void> switchProvider(String providerId) async {
    await _put(
      '/api/providers/current',
      {'providerId': providerId},
    );
  }

  Future<void> approveWebAuth(String sessionId) async {
    await _post('/api/auth/web/approve', {'sessionId': sessionId});
  }

  Future<void> reportError({
    required String platform,
    required String version,
    required String errorCode,
    required String message,
    String? stackTrace,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      await _post('/api/errors', {
        'platform': platform,
        'version': version,
        'errorCode': errorCode,
        'message': message,
        if (stackTrace != null) 'stackTrace': stackTrace,
        if (metadata != null) 'metadata': metadata,
      });
    } catch (_) {
      // silently ignore - error reporting should not cause more errors
    }
  }
}

ApiClient createApiClient(
  String baseUrl, {
  String? token,
  http.Client? httpClient,
}) {
  return ApiClient._(normalizeUrl(baseUrl), token, httpClient ?? http.Client());
}
