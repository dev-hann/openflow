import 'package:equatable/equatable.dart';

enum MessageRole { user, assistant }

class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.isStreaming = false,
    this.isFailed = false,
  });
  final String id;
  final MessageRole role;
  final String content;
  final bool isStreaming;
  final bool isFailed;
  final DateTime timestamp;

  ChatMessage copyWith({
    String? content,
    bool? isStreaming,
    bool? isFailed,
  }) {
    return ChatMessage(
      id: id,
      role: role,
      content: content ?? this.content,
      isStreaming: isStreaming ?? this.isStreaming,
      isFailed: isFailed ?? this.isFailed,
      timestamp: timestamp,
    );
  }

  @override
  List<Object?> get props =>
      [id, role, content, isStreaming, isFailed, timestamp];
}

sealed class WsClientMessage {
  const WsClientMessage();
  Map<String, dynamic> toJson();
}

class WsChatMsg extends WsClientMessage {
  const WsChatMsg({required this.sessionId, required this.content});
  final String sessionId;
  final String content;

  @override
  Map<String, dynamic> toJson() => {
        'type': 'chat',
        'session_id': sessionId,
        'content': content,
      };
}

class WsSwitchSession extends WsClientMessage {
  const WsSwitchSession({required this.sessionId});
  final String sessionId;

  @override
  Map<String, dynamic> toJson() => {
        'type': 'switch_session',
        'session_id': sessionId,
      };
}

class WsPing extends WsClientMessage {
  const WsPing();
  @override
  Map<String, dynamic> toJson() => {'type': 'ping'};
}

class WsAuth extends WsClientMessage {
  const WsAuth({required this.accessToken});
  final String accessToken;

  @override
  Map<String, dynamic> toJson() => {
        'type': 'auth',
        'access_token': accessToken,
      };
}

sealed class WsServerMessage {
  const WsServerMessage();
  static WsServerMessage fromJson(Map<String, dynamic> json) {
    return switch (json['type'] as String) {
      'token' => WsTokenChunk(
          sessionId: json['session_id'] as String,
          content: json['content'] as String,
        ),
      'response' => WsResponse(
          sessionId: json['session_id'] as String,
          content: json['content'] as String,
        ),
      'error' => WsError(
          sessionId: json['session_id'] as String? ?? '',
          code: json['code'] as String? ?? 'UNKNOWN',
          message: json['message'] as String? ?? '',
        ),
      'auth_required' => const WsAuthRequired(),
      'auth_ok' => const WsAuthOk(),
      'session_switched' => WsSessionSwitched(
          sessionId: json['session_id'] as String,
        ),
      'pong' => const WsPong(),
      _ => throw FormatException('Unknown WS message type: ${json['type']}'),
    };
  }
}

class WsTokenChunk extends WsServerMessage {
  const WsTokenChunk({required this.sessionId, required this.content});
  final String sessionId;
  final String content;
}

class WsResponse extends WsServerMessage {
  const WsResponse({required this.sessionId, required this.content});
  final String sessionId;
  final String content;
}

class WsError extends WsServerMessage {
  const WsError({
    required this.sessionId,
    required this.code,
    required this.message,
  });
  final String sessionId;
  final String code;
  final String message;
}

class WsAuthRequired extends WsServerMessage {
  const WsAuthRequired();
}

class WsAuthOk extends WsServerMessage {
  const WsAuthOk();
}

class WsSessionSwitched extends WsServerMessage {
  const WsSessionSwitched({required this.sessionId});
  final String sessionId;
}

class WsPong extends WsServerMessage {
  const WsPong();
}

class SessionInfo extends Equatable {
  const SessionInfo({
    required this.id,
    required this.title,
    required this.createdAt,
  });

  factory SessionInfo.fromJson(Map<String, dynamic> json) => SessionInfo(
        id: json['id'] as String,
        title: json['title'] as String? ?? '새 대화',
        createdAt: DateTime.fromMillisecondsSinceEpoch(
          (json['created_at'] as num).toInt() * 1000,
        ),
      );
  final String id;
  final String title;
  final DateTime createdAt;

  @override
  List<Object?> get props => [id, title, createdAt];
}

class TokenPair extends Equatable {
  const TokenPair({required this.accessToken, required this.refreshToken});

  factory TokenPair.fromJson(Map<String, dynamic> json) => TokenPair(
        accessToken: json['access_token'] as String,
        refreshToken: json['refresh_token'] as String,
      );
  final String accessToken;
  final String refreshToken;

  @override
  List<Object?> get props => [accessToken, refreshToken];
}

class StoredAuth extends Equatable {
  const StoredAuth({
    required this.serverUrl,
    required this.accessToken,
    required this.refreshToken,
    required this.pairedAt,
  });

  factory StoredAuth.fromJson(Map<String, dynamic> json) => StoredAuth(
        serverUrl: json['serverUrl'] as String,
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        pairedAt: DateTime.fromMillisecondsSinceEpoch(
          (json['pairedAt'] as num).toInt(),
        ),
      );
  final String serverUrl;
  final String accessToken;
  final String refreshToken;
  final DateTime pairedAt;

  Map<String, dynamic> toJson() => {
        'serverUrl': serverUrl,
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'pairedAt': pairedAt.millisecondsSinceEpoch,
      };

  @override
  List<Object?> get props => [serverUrl, accessToken, refreshToken, pairedAt];
}

class ProviderInfo extends Equatable {
  const ProviderInfo({
    required this.id,
    required this.name,
    required this.baseUrl,
    required this.model,
    required this.createdAt,
    this.apiKeySet = false,
    this.isActive = false,
  });

  factory ProviderInfo.fromJson(Map<String, dynamic> json) => ProviderInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        baseUrl: json['base_url'] as String,
        model: json['model'] as String? ?? '',
        apiKeySet: json['api_key_set'] as bool? ?? false,
        isActive: json['is_active'] as bool? ?? false,
        createdAt: DateTime.fromMillisecondsSinceEpoch(
          (json['created_at'] as num).toInt() * 1000,
        ),
      );
  final String id;
  final String name;
  final String baseUrl;
  final String model;
  final bool apiKeySet;
  final bool isActive;
  final DateTime createdAt;

  ProviderInfo copyWith({
    String? name,
    String? baseUrl,
    String? model,
    bool? apiKeySet,
    bool? isActive,
  }) {
    return ProviderInfo(
      id: id,
      name: name ?? this.name,
      baseUrl: baseUrl ?? this.baseUrl,
      model: model ?? this.model,
      apiKeySet: apiKeySet ?? this.apiKeySet,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt,
    );
  }

  @override
  List<Object?> get props =>
      [id, name, baseUrl, model, apiKeySet, isActive, createdAt];
}
