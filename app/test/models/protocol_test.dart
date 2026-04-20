import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/models/protocol.dart';

void main() {
  group('ChatMessage', () {
    test('supports equality', () {
      final ts = DateTime(2025);
      final a = ChatMessage(
        id: '1',
        role: MessageRole.user,
        content: 'hello',
        timestamp: ts,
      );
      final b = ChatMessage(
        id: '1',
        role: MessageRole.user,
        content: 'hello',
        timestamp: ts,
      );
      expect(a, equals(b));
    });

    test('copyWith preserves unchanged fields', () {
      final ts = DateTime(2025);
      final msg = ChatMessage(
        id: '1',
        role: MessageRole.assistant,
        content: 'hi',
        timestamp: ts,
      );
      final copied = msg.copyWith(content: 'hello');
      expect(copied.id, '1');
      expect(copied.content, 'hello');
      expect(copied.isStreaming, false);
      expect(copied.isFailed, false);
    });

    test('copyWith updates specified fields', () {
      final ts = DateTime(2025);
      final msg = ChatMessage(
        id: '1',
        role: MessageRole.assistant,
        content: '',
        isStreaming: true,
        timestamp: ts,
      );
      final copied = msg.copyWith(
        content: 'done',
        isStreaming: false,
        isFailed: true,
      );
      expect(copied.content, 'done');
      expect(copied.isStreaming, false);
      expect(copied.isFailed, true);
    });
  });

  group('WsClientMessage', () {
    test('WsChatMsg serializes correctly', () {
      const msg = WsChatMsg(sessionId: 's1', content: 'hello');
      final json = msg.toJson();
      expect(json['type'], 'chat');
      expect(json['session_id'], 's1');
      expect(json['content'], 'hello');
    });

    test('WsSwitchSession serializes correctly', () {
      const msg = WsSwitchSession(sessionId: 's2');
      final json = msg.toJson();
      expect(json['type'], 'switch_session');
      expect(json['session_id'], 's2');
    });

    test('WsPing serializes correctly', () {
      const msg = WsPing();
      expect(msg.toJson(), {'type': 'ping'});
    });

    test('WsAuth serializes correctly', () {
      const msg = WsAuth(accessToken: 'at_test123');
      final json = msg.toJson();
      expect(json['type'], 'auth');
      expect(json['access_token'], 'at_test123');
    });
  });

  group('WsServerMessage', () {
    test('parses token chunk', () {
      final msg = WsServerMessage.fromJson(const {
        'type': 'token',
        'session_id': 's1',
        'content': 'Hello',
      });
      expect(msg, isA<WsTokenChunk>());
      final chunk = msg as WsTokenChunk;
      expect(chunk.sessionId, 's1');
      expect(chunk.content, 'Hello');
    });

    test('parses response', () {
      final msg = WsServerMessage.fromJson(const {
        'type': 'response',
        'session_id': 's1',
        'content': 'Done',
      });
      expect(msg, isA<WsResponse>());
      expect((msg as WsResponse).content, 'Done');
    });

    test('parses error with defaults', () {
      final msg = WsServerMessage.fromJson(const {'type': 'error'});
      expect(msg, isA<WsError>());
      final err = msg as WsError;
      expect(err.sessionId, '');
      expect(err.code, 'UNKNOWN');
      expect(err.message, '');
    });

    test('parses auth_required', () {
      final msg = WsServerMessage.fromJson(const {'type': 'auth_required'});
      expect(msg, isA<WsAuthRequired>());
    });

    test('parses auth_ok', () {
      final msg = WsServerMessage.fromJson(const {'type': 'auth_ok'});
      expect(msg, isA<WsAuthOk>());
    });

    test('parses session_switched', () {
      final msg = WsServerMessage.fromJson(const {
        'type': 'session_switched',
        'session_id': 's3',
      });
      expect(msg, isA<WsSessionSwitched>());
      expect((msg as WsSessionSwitched).sessionId, 's3');
    });

    test('parses pong', () {
      final msg = WsServerMessage.fromJson(const {'type': 'pong'});
      expect(msg, isA<WsPong>());
    });

    test('throws on unknown type', () {
      expect(
        () => WsServerMessage.fromJson(const {'type': 'unknown'}),
        throwsFormatException,
      );
    });
  });

  group('SessionInfo', () {
    test('fromJson parses correctly', () {
      final info = SessionInfo.fromJson(const {
        'id': 's1',
        'title': 'Test Session',
        'created_at': 1700000000,
      });
      expect(info.id, 's1');
      expect(info.title, 'Test Session');
    });

    test('fromJson uses default title when null', () {
      final info = SessionInfo.fromJson(const {
        'id': 's1',
        'created_at': 1700000000,
      });
      expect(info.title, '새 대화');
    });

    test('supports equality', () {
      final ts = DateTime.fromMillisecondsSinceEpoch(1700000000 * 1000);
      final a = SessionInfo(id: 's1', title: 'Test', createdAt: ts);
      final b = SessionInfo(id: 's1', title: 'Test', createdAt: ts);
      expect(a, equals(b));
    });
  });

  group('TokenPair', () {
    test('fromJson parses correctly', () {
      final pair = TokenPair.fromJson(const {
        'access_token': 'at_abc',
        'refresh_token': 'rt_xyz',
      });
      expect(pair.accessToken, 'at_abc');
      expect(pair.refreshToken, 'rt_xyz');
    });
  });

  group('StoredAuth', () {
    test('roundtrip toJson/fromJson', () {
      final auth = StoredAuth(
        serverUrl: 'http://localhost:9800',
        accessToken: 'at_test',
        refreshToken: 'rt_test',
        pairedAt: DateTime(2025, 6, 15, 12),
      );
      final json = auth.toJson();
      final restored = StoredAuth.fromJson(json);
      expect(restored.serverUrl, auth.serverUrl);
      expect(restored.accessToken, auth.accessToken);
      expect(restored.refreshToken, auth.refreshToken);
      expect(restored.pairedAt, auth.pairedAt);
    });
  });

  group('ProviderInfo', () {
    test('fromJson parses correctly', () {
      final provider = ProviderInfo.fromJson(const {
        'id': 'p1',
        'name': 'OpenAI',
        'base_url': 'https://api.openai.com',
        'model': 'gpt-4o',
        'api_key_set': true,
        'is_active': true,
        'created_at': 1700000000,
      });
      expect(provider.id, 'p1');
      expect(provider.name, 'OpenAI');
      expect(provider.apiKeySet, true);
      expect(provider.isActive, true);
    });

    test('fromJson uses defaults for optional fields', () {
      final provider = ProviderInfo.fromJson(const {
        'id': 'p1',
        'name': 'Test',
        'base_url': 'http://localhost',
        'created_at': 1700000000,
      });
      expect(provider.model, '');
      expect(provider.apiKeySet, false);
      expect(provider.isActive, false);
    });

    test('copyWith preserves unchanged fields', () {
      final provider = ProviderInfo(
        id: 'p1',
        name: 'Test',
        baseUrl: 'http://localhost',
        model: 'gpt-4',
        createdAt: DateTime(2025),
      );
      final updated = provider.copyWith(name: 'Updated');
      expect(updated.id, 'p1');
      expect(updated.name, 'Updated');
      expect(updated.model, 'gpt-4');
    });
  });
}
