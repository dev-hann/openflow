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

  ApiClient createTestClient({String? token}) {
    capturedRequests = [];
    customHandler = null;

    final mockClient = MockClient((req) {
      capturedRequests.add(req);
      if (customHandler != null) {
        return Future.value(customHandler!(req));
      }
      return Future.value(okResponse());
    });

    return createApiClient(
      'http://localhost:9800',
      token: token,
      httpClient: mockClient,
    );
  }

  group('pairInit', () {
    test('sends POST /api/auth/pair/init', () async {
      apiClient = createTestClient();
      customHandler = (req) => okResponse({'expiresInMs': 300000});
      await apiClient.pairInit();
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/auth/pair/init');
    });
  });

  group('pairVerify', () {
    test('sends POST /api/auth/pair/verify with pin and label', () async {
      apiClient = createTestClient();
      customHandler = (req) => okResponse({
            'accessToken': 'at_test',
            'refreshToken': 'rt_test',
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
      apiClient = createTestClient();
      customHandler = (req) => okResponse({
            'accessToken': 'at_new',
            'refreshToken': 'rt_new',
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
    test('sends DELETE /api/auth/unpair with auth header', () async {
      apiClient = createTestClient(token: 'at_test');
      await apiClient.unpair();
      final req = lastRequest();
      expect(req.method, 'DELETE');
      expect(req.url.path, '/api/auth/unpair');
      expect(req.headers['Authorization'], 'Bearer at_test');
    });
  });

  group('listSessions', () {
    test('sends GET /api/sessions', () async {
      apiClient = createTestClient(token: 'at_test');
      customHandler = (req) =>
          okResponse(<String, dynamic>{'sessions': <Map<String, dynamic>>[]});
      await apiClient.listSessions();
      final req = lastRequest();
      expect(req.method, 'GET');
      expect(req.url.path, '/api/sessions');
    });
  });

  group('createSession', () {
    test('sends POST /api/sessions', () async {
      apiClient = createTestClient(token: 'at_test');
      customHandler = (req) =>
          okResponse({'id': 's1', 'title': 'test', 'createdAt': 1000});
      await apiClient.createSession();
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/sessions');
    });
  });

  group('deleteSession', () {
    test('sends DELETE /api/sessions/:id', () async {
      apiClient = createTestClient(token: 'at_test');
      await apiClient.deleteSession('s1');
      final req = lastRequest();
      expect(req.method, 'DELETE');
      expect(req.url.path, '/api/sessions/s1');
    });
  });

  group('getStatus', () {
    test('sends GET /api/status', () async {
      apiClient = createTestClient(token: 'at_test');
      customHandler = (req) => okResponse({'status': 'ok'});
      await apiClient.getStatus();
      final req = lastRequest();
      expect(req.method, 'GET');
      expect(req.url.path, '/api/status');
    });
  });

  group('listProviders', () {
    test('sends GET /api/providers', () async {
      apiClient = createTestClient(token: 'at_test');
      customHandler = (req) =>
          okResponse(<String, dynamic>{'providers': <Map<String, dynamic>>[]});
      await apiClient.listProviders();
      final req = lastRequest();
      expect(req.method, 'GET');
      expect(req.url.path, '/api/providers');
    });
  });

  group('createProvider', () {
    test('sends POST /api/providers', () async {
      apiClient = createTestClient(token: 'at_test');
      customHandler = (req) => okResponse({
            'id': 'p1',
            'name': 'test',
            'baseUrl': 'http://x',
            'model': 'gpt-4',
            'createdAt': 1000,
          });
      await apiClient.createProvider({
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
      apiClient = createTestClient(token: 'at_test');
      customHandler = (req) => okResponse({
            'id': 'p1',
            'name': 'new',
            'baseUrl': 'http://x',
            'model': 'gpt-4',
            'createdAt': 1000,
          });
      await apiClient.updateProvider('p1', {'name': 'new'});
      final req = lastRequest();
      expect(req.method, 'PUT');
      expect(req.url.path, '/api/providers/p1');
    });
  });

  group('deleteProvider', () {
    test('sends DELETE /api/providers/:id', () async {
      apiClient = createTestClient(token: 'at_test');
      await apiClient.deleteProvider('p1');
      final req = lastRequest();
      expect(req.method, 'DELETE');
      expect(req.url.path, '/api/providers/p1');
    });
  });

  group('verifyProvider', () {
    test('sends POST /api/providers/:id/verify', () async {
      apiClient = createTestClient(token: 'at_test');
      customHandler = (req) => okResponse({'ok': true});
      await apiClient.verifyProvider('p1');
      final req = lastRequest();
      expect(req.method, 'POST');
      expect(req.url.path, '/api/providers/p1/verify');
    });
  });

  group('fetchProviderModels', () {
    test('sends GET /api/providers/:id/models', () async {
      apiClient = createTestClient(token: 'at_test');
      customHandler = (req) => okResponse({
            'models': ['gpt-4'],
          });
      await apiClient.fetchProviderModels('p1');
      final req = lastRequest();
      expect(req.method, 'GET');
      expect(req.url.path, '/api/providers/p1/models');
    });
  });

  group('switchProvider', () {
    test('sends PUT /api/providers/current with providerId field', () async {
      apiClient = createTestClient(token: 'at_test');
      await apiClient.switchProvider('p1');
      final req = lastRequest();
      expect(req.method, 'PUT');
      expect(req.url.path, '/api/providers/current');
      final body = jsonDecode(req.body) as Map<String, dynamic>;
      expect(body['providerId'], 'p1');
    });
  });

  group('error handling', () {
    test('throws ApiException on 4xx response', () {
      apiClient = createTestClient();
      customHandler = (req) => http.Response(
            jsonEncode(
              <String, dynamic>{
                'code': 'invalid_or_expired_pin',
                'message': 'Invalid PIN',
              },
            ),
            401,
          );
      expect(
        () => apiClient.pairVerify('000000', 'test'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)),
      );
    });
  });
}
