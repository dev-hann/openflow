import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/normalize_url.dart';

class ApiError implements Exception {
  ApiError({required this.status, required this.code, required this.message});
  final int status;
  final String code;
  final String message;

  @override
  String toString() => 'ApiError($status $code): $message';
}

class ApiClient {
  ApiClient(this.baseUrl, {http.Client? httpClient})
      : _httpClient = httpClient ?? http.Client();
  final String baseUrl;
  final http.Client _httpClient;
  static const _timeout = Duration(seconds: 15);

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Map<String, String> _headers([String? token]) => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> _get(String path, [String? token]) async {
    final response = await _httpClient
        .get(_uri(path), headers: _headers(token))
        .timeout(_timeout);
    return _parse(response);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body, [
    String? token,
  ]) async {
    final response = await _httpClient
        .post(_uri(path), headers: _headers(token), body: jsonEncode(body))
        .timeout(_timeout);
    return _parse(response);
  }

  Future<Map<String, dynamic>> _put(
    String path,
    Map<String, dynamic> body, [
    String? token,
  ]) async {
    final response = await _httpClient
        .put(_uri(path), headers: _headers(token), body: jsonEncode(body))
        .timeout(_timeout);
    return _parse(response);
  }

  Future<Map<String, dynamic>> _delete(String path, String token) async {
    final response = await _httpClient
        .delete(_uri(path), headers: _headers(token))
        .timeout(_timeout);
    return _parse(response);
  }

  Map<String, dynamic> _parse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiError(
        status: response.statusCode,
        code: body['code'] as String? ?? 'UNKNOWN',
        message: body['message'] as String? ?? '',
      );
    }
    return body;
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

  Future<void> unpair(String accessToken) async {
    await _delete('/api/auth/unpair', accessToken);
  }

  Future<List<SessionInfo>> listSessions(String accessToken) async {
    final json = await _get('/api/sessions', accessToken);
    final list = json['sessions'] as List<dynamic>;
    return list
        .map((e) => SessionInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<SessionInfo> createSession(
    String accessToken, [
    String? title,
  ]) async {
    final json = await _post(
      '/api/sessions',
      {
        if (title != null) 'title': title,
      },
      accessToken,
    );
    return SessionInfo.fromJson(json);
  }

  Future<void> deleteSession(String accessToken, String sessionId) async {
    await _delete('/api/sessions/$sessionId', accessToken);
  }

  Future<Map<String, dynamic>> getStatus() => _get('/api/status');

  Future<List<ProviderInfo>> listProviders(String accessToken) async {
    final json = await _get('/api/providers', accessToken);
    final list = json['providers'] as List<dynamic>;
    return list
        .map((e) => ProviderInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ProviderInfo> createProvider(
    String accessToken,
    Map<String, dynamic> params,
  ) async {
    final json = await _post('/api/providers', params, accessToken);
    return ProviderInfo.fromJson(json);
  }

  Future<ProviderInfo> updateProvider(
    String accessToken,
    String id,
    Map<String, dynamic> params,
  ) async {
    final json = await _put('/api/providers/$id', params, accessToken);
    return ProviderInfo.fromJson(json);
  }

  Future<void> deleteProvider(String accessToken, String id) async {
    await _delete('/api/providers/$id', accessToken);
  }

  Future<Map<String, dynamic>> verifyProvider(
    String accessToken,
    String id,
  ) async {
    return _post('/api/providers/$id/verify', {}, accessToken);
  }

  Future<List<String>> fetchProviderModels(
    String accessToken,
    String id,
  ) async {
    final json = await _get('/api/providers/$id/models', accessToken);
    final list = json['models'] as List<dynamic>;
    return list.map((e) => e as String).toList();
  }

  Future<void> switchProvider(String accessToken, String providerId) async {
    await _put(
      '/api/providers/current',
      {'providerId': providerId},
      accessToken,
    );
  }
}

ApiClient createApiClient(String baseUrl) {
  return ApiClient(normalizeUrl(baseUrl));
}
