import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:openflow/services/api_client.dart';

void main() {
  late ApiClient apiClient;
  late List<http.Request> capturedRequests;
  http.Response Function(http.Request)? customHandler;

  http.Response okResponse([Map<String, dynamic>? body]) {
    return http.Response(jsonEncode(body ?? {'ok': true}), 200);
  }

  http.Request lastRequest() => capturedRequests.last;

  setUp(() {
    capturedRequests = [];
    customHandler = null;

    final mockClient = MockClient((req) {
      capturedRequests.add(req);
      if (customHandler != null) {
        return Future.value(customHandler!(req));
      }
      return Future.value(okResponse());
    });

    apiClient = ApiClient('http://localhost:9800', httpClient: mockClient);
  });

  group('pairInit', () {
    test('sends POST /api/auth/pair/init', () async {
      customHandler = (req) => okResponse({'expiresInMs': 300000});
      await apiClient.pairInit();
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/auth/pair/init');
    });
  });

  group('pairVerify', () {
    test('sends POST /api/auth/pair/verify with pin and label', () async {
      customHandler = (req) => okResponse({
            'access_token': 'at_test',
            'refresh_token': 'rt_test',
          });
      await apiClient.pairVerify('123456', 'pixel');
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/auth/pair/verify');
      final body = jsonDecode(req.body) as Map<String, dynamic>;
      expect(body['pin'], '123456');
      expect(body['label'], 'pixel');
    });
  });

  group('refreshToken', () {
    test('sends POST /api/auth/refresh with refreshToken field', () async {
      customHandler = (req) => okResponse({
            'access_token': 'at_new',
            'refresh_token': 'rt_new',
          });
      await apiClient.refreshToken('rt_old');
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/auth/refresh');
      final body = jsonDecode(req.body) as Map<String, dynamic>;
      expect(body['refreshToken'], 'rt_old');
    });
  });

  group('unpair', () {
    test('sends DELETE /api/auth/unpair', () async {
      await apiClient.unpair('at_test');
      final req = lastRequest();
      expect(req.method, 'DELETE');
      expect(req.url.path, '/api/auth/unpair');
      expect(req.headers['Authorization'], 'Bearer at_test');
    });
  });

  group('listSessions', () {
    test('sends GET /api/sessions', () async {
      customHandler = (req) => okResponse({'sessions': []});
      await apiClient.listSessions('at_test');
      final req = lastRequest();
      expect(req.method, 'GET');
      expect(req.url.path, '/api/sessions');
    });
  });

  group('createSession', () {
    test('sends POST /api/sessions', () async {
      customHandler = (req) => okResponse({'id': 's1', 'title': 'test', 'created_at': 1000});
      await apiClient.createSession('at_test');
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/sessions');
    });
  });

  group('deleteSession', () {
    test('sends DELETE /api/sessions/:id', () async {
      await apiClient.deleteSession('at_test', 's1');
      final req = lastRequest();
      expect(req.method, 'DELETE');
      expect(req.url.path, '/api/sessions/s1');
    });
  });

  group('getStatus', () {
    test('sends GET /api/status', () async {
      customHandler = (req) => okResponse({'status': 'ok'});
      await apiClient.getStatus();
      final req = lastRequest();
      expect(req.method, 'GET');
      expect(req.url.path, '/api/status');
    });
  });

  group('listProviders', () {
    test('sends GET /api/providers', () async {
      customHandler = (req) => okResponse({'providers': []});
      await apiClient.listProviders('at_test');
      final req = lastRequest();
      expect(req.method, 'GET');
      expect(req.url.path, '/api/providers');
    });
  });

  group('createProvider', () {
    test('sends POST /api/providers', () async {
      customHandler = (req) => okResponse({
            'id': 'p1',
            'name': 'test',
            'base_url': 'http://x',
            'model': 'gpt-4',
            'created_at': 1000,
          });
      await apiClient.createProvider('at_test', {
        'name': 'test',
        'baseUrl': 'http://x',
        'apiKey': 'sk-test',
        'model': 'gpt-4',
      });
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/providers');
    });
  });

  group('updateProvider', () {
    test('sends PUT /api/providers/:id', () async {
      customHandler = (req) => okResponse({
            'id': 'p1',
            'name': 'new',
            'base_url': 'http://x',
            'model': 'gpt-4',
            'created_at': 1000,
          });
      await apiClient.updateProvider('at_test', 'p1', {'name': 'new'});
      final req = lastRequest();
      expect(req.method, 'PUT');
      expect(req.url.path, '/api/providers/p1');
    });
  });

  group('deleteProvider', () {
    test('sends DELETE /api/providers/:id', () async {
      await apiClient.deleteProvider('at_test', 'p1');
      final req = lastRequest();
      expect(req.method, 'DELETE');
      expect(req.url.path, '/api/providers/p1');
    });
  });

  group('verifyProvider', () {
    test('sends POST /api/providers/:id/verify', () async {
      customHandler = (req) => okResponse({'ok': true});
      await apiClient.verifyProvider('at_test', 'p1');
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/providers/p1/verify');
    });
  });

  group('fetchProviderModels', () {
    test('sends GET /api/providers/:id/models', () async {
      customHandler = (req) => okResponse({'models': ['gpt-4']});
      await apiClient.fetchProviderModels('at_test', 'p1');
      final req = lastRequest();
      expect(req.method, 'GET');
      expect(req.url.path, '/api/providers/p1/models');
    });
  });

  group('switchProvider', () {
    test('sends PUT /api/providers/current with providerId field', () async {
      await apiClient.switchProvider('at_test', 'p1');
      final req = lastRequest();
      expect(req.method, 'PUT');
      expect(req.url.path, '/api/providers/current');
      final body = jsonDecode(req.body) as Map<String, dynamic>;
      expect(body['providerId'], 'p1');
    });
  });

  group('error handling', () {
    test('throws ApiError on 4xx response', () {
      customHandler = (req) => http.Response(
            jsonEncode(
                {'code': 'invalid_or_expired_pin', 'message': 'Invalid PIN'}),
            401,
          );
      expect(
        () => apiClient.pairVerify('000000', 'test'),
        throwsA(isA<ApiError>().having((e) => e.status, 'status', 401)),
      );
    });
  });
}
