import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:openflow/services/api_client.dart';

void main() {
  const serverRoutes = <(String, String)>[
    ('POST', '/api/auth/pair/init'),
    ('POST', '/api/auth/pair/verify'),
    ('POST', '/api/auth/refresh'),
    ('DELETE', '/api/auth/unpair'),
    ('GET', '/api/status'),
    ('GET', '/api/sessions'),
    ('POST', '/api/sessions'),
    ('GET', '/api/providers'),
    ('POST', '/api/providers'),
    ('PUT', '/api/providers/current'),
    ('GET', '/api/providers/:id/models'),
    ('POST', '/api/providers/:id/verify'),
    ('DELETE', '/api/providers/:id'),
    ('PUT', '/api/providers/:id'),
    ('DELETE', '/api/sessions/:id'),
  ];

  ApiClient createTestClient(List<http.Request> capturedRequests) {
    final mockClient = MockClient((req) {
      capturedRequests.add(req);
      return Future.value(
        http.Response(
          jsonEncode(_okBodyFor(req.method, req.url.path)),
          200,
        ),
      );
    });

    return createApiClient(
      'http://localhost:9800',
      token: 'at',
      httpClient: mockClient,
    );
  }

  Future<void> exerciseAllRoutes(ApiClient apiClient) async {
    await apiClient.pairInit();
    await apiClient.pairVerify('123', 'dev');
    await apiClient.refreshToken('rt');
    await apiClient.unpair();
    await apiClient.getStatus();
    await apiClient.listSessions();
    await apiClient.createSession();
    await apiClient.deleteSession('s1');
    await apiClient.listProviders();
    await apiClient.createProvider({
      'name': 'n',
      'baseUrl': 'http://x',
      'apiKey': 'k',
      'model': 'm',
    });
    await apiClient.updateProvider('p1', {'name': 'n2'});
    await apiClient.deleteProvider('p1');
    await apiClient.switchProvider('p1');
    await apiClient.verifyProvider('p1');
    await apiClient.fetchProviderModels('p1');
  }

  test('ApiClient covers every server route', () async {
    final capturedRequests = <http.Request>[];
    final apiClient = createTestClient(capturedRequests);

    await exerciseAllRoutes(apiClient);

    final exercised = capturedRequests.map((req) {
      return (req.method, _normalizePath(req.url.path));
    }).toSet();

    for (final (method, path) in serverRoutes) {
      expect(
        exercised,
        contains((method, path)),
        reason: 'Missing route: $method $path',
      );
    }
  });

  test('no unexpected routes in ApiClient', () async {
    final capturedRequests = <http.Request>[];
    final apiClient = createTestClient(capturedRequests);

    await exerciseAllRoutes(apiClient);

    final serverSet = serverRoutes.toSet();
    for (final req in capturedRequests) {
      expect(
        serverSet,
        contains((req.method, _normalizePath(req.url.path))),
        reason: 'Unexpected route: ${req.method} ${req.url.path}',
      );
    }
  });
}

String _normalizePath(String path) {
  if (path == '/api/providers/current') return path;
  if (RegExp(r'^/api/providers/[^/]+/models$').hasMatch(path)) {
    return '/api/providers/:id/models';
  }
  if (RegExp(r'^/api/providers/[^/]+/verify$').hasMatch(path)) {
    return '/api/providers/:id/verify';
  }
  if (RegExp(r'^/api/providers/[^/]+$').hasMatch(path)) {
    return '/api/providers/:id';
  }
  if (RegExp(r'^/api/sessions/[^/]+$').hasMatch(path)) {
    return '/api/sessions/:id';
  }
  return path;
}

const Map<String, dynamic> _providerJson = {
  'id': 'p1',
  'name': 'n',
  'baseUrl': 'http://x',
  'model': 'm',
  'createdAt': 0,
};

Map<String, dynamic> _okBodyFor(String method, String path) {
  if (path.contains('pair/verify') || path.contains('auth/refresh')) {
    return {'accessToken': 'a', 'refreshToken': 'r'};
  }
  if (path.endsWith('/models')) {
    return {
      'models': ['m1'],
    };
  }
  if (path.endsWith('/verify')) {
    return {'ok': true};
  }
  if (path.endsWith('/providers') && method == 'GET') {
    return <String, dynamic>{'providers': <Map<String, dynamic>>[]};
  }
  if (path.endsWith('/providers') && method == 'POST') {
    return <String, dynamic>{..._providerJson};
  }
  if (path == '/api/providers/current') {
    return {'ok': true, 'providerId': 'p1'};
  }
  if (path.endsWith('/sessions') && method == 'GET') {
    return <String, dynamic>{'sessions': <Map<String, dynamic>>[]};
  }
  if (path.endsWith('/sessions') && method == 'POST') {
    return {'id': 's1', 'title': 't', 'createdAt': 1000};
  }
  if (path.contains('/providers/') && method != 'DELETE') {
    return {..._providerJson};
  }
  return {'ok': true};
}
