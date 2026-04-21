import 'package:equatable/equatable.dart';

export 'package:openflow/models/provider_info.dart';

enum MessageRole { user, assistant }

class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.sessionId,
    this.isStreaming = false,
    this.isFailed = false,
  });
  final String id;
  final MessageRole role;
  final String content;
  final String? sessionId;
  final bool isStreaming;
  final bool isFailed;
  final DateTime timestamp;

  ChatMessage copyWith({
    String? content,
    String? sessionId,
    bool? isStreaming,
    bool? isFailed,
  }) {
    return ChatMessage(
      id: id,
      role: role,
      content: content ?? this.content,
      sessionId: sessionId ?? this.sessionId,
      isStreaming: isStreaming ?? this.isStreaming,
      isFailed: isFailed ?? this.isFailed,
      timestamp: timestamp,
    );
  }

  @override
  List<Object?> get props =>
      [id, role, content, sessionId, isStreaming, isFailed, timestamp];
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
        'type': 'message',
        'sessionId': sessionId,
        'content': content,
      };
}

class WsSwitchSession extends WsClientMessage {
  const WsSwitchSession({required this.sessionId});
  final String sessionId;

  @override
  Map<String, dynamic> toJson() => {
        'type': 'switch_session',
        'sessionId': sessionId,
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
        'accessToken': accessToken,
      };
}

sealed class WsServerMessage extends Equatable {
  const WsServerMessage();

  static WsServerMessage fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String;
    return switch (type) {
      'token' => WsTokenChunk(
          sessionId: json['sessionId'] as String? ?? '',
          content: json['content'] as String? ?? '',
        ),
      'response' => WsResponse(
          sessionId: json['sessionId'] as String? ?? '',
          content: json['content'] as String? ?? '',
        ),
      'error' => WsError(
          sessionId: json['sessionId'] as String? ?? '',
          code: json['code'] as String? ?? 'UNKNOWN',
          message: json['message'] as String? ?? '',
        ),
      'auth_required' => const WsAuthRequired(),
      'auth_ok' => const WsAuthOk(),
      'session_switched' => WsSessionSwitched(
          sessionId: json['sessionId'] as String? ?? '',
        ),
      'pong' => const WsPong(),
      _ => WsUnknown(rawType: type, data: json),
    };
  }
}

class WsTokenChunk extends WsServerMessage {
  const WsTokenChunk({required this.sessionId, required this.content});
  final String sessionId;
  final String content;

  @override
  List<Object?> get props => [sessionId, content];
}

class WsResponse extends WsServerMessage {
  const WsResponse({required this.sessionId, required this.content});
  final String sessionId;
  final String content;

  @override
  List<Object?> get props => [sessionId, content];
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

  @override
  List<Object?> get props => [sessionId, code, message];
}

class WsAuthRequired extends WsServerMessage {
  const WsAuthRequired();

  @override
  List<Object?> get props => [];
}

class WsAuthOk extends WsServerMessage {
  const WsAuthOk();

  @override
  List<Object?> get props => [];
}

class WsSessionSwitched extends WsServerMessage {
  const WsSessionSwitched({required this.sessionId});
  final String sessionId;

  @override
  List<Object?> get props => [sessionId];
}

class WsPong extends WsServerMessage {
  const WsPong();

  @override
  List<Object?> get props => [];
}

class WsUnknown extends WsServerMessage {
  const WsUnknown({required this.rawType, required this.data});
  final String rawType;
  final Map<String, dynamic> data;

  @override
  List<Object?> get props => [rawType, data];
}

class SessionInfo extends Equatable {
  const SessionInfo({
    required this.id,
    required this.title,
    required this.createdAt,
  });

  factory SessionInfo.fromJson(Map<String, dynamic> json) => SessionInfo(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '새 대화',
        createdAt: json['createdAt'] != null
            ? DateTime.fromMillisecondsSinceEpoch(
                (json['createdAt'] as num).toInt(),
              )
            : DateTime.now(),
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
        accessToken: json['accessToken'] as String? ?? '',
        refreshToken: json['refreshToken'] as String? ?? '',
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
