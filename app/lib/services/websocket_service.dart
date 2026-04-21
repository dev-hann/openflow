import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/normalize_url.dart';

typedef WsMessageCallback = void Function(WsServerMessage);
typedef NoArgsCallback = void Function();

enum WsConnectionState { disconnected, connecting, connected, reconnecting }

class WebSocketService {
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _pingTimer;
  Timer? _reconnectTimer;

  String? _wsUrl;
  String? _accessToken;
  int _reconnectAttempts = 0;
  bool _intentionalDisconnect = false;
  bool _authFailed = false;
  bool _disposed = false;
  WsConnectionState _connectionState = WsConnectionState.disconnected;
  final List<String> _pendingMessages = [];

  static const _baseReconnectDelay = Duration(seconds: 1);
  static const _maxReconnectDelay = Duration(seconds: 30);
  static const _pingInterval = Duration(seconds: 30);
  static const _maxReconnectAttempts = 20;

  NoArgsCallback? onConnected;
  NoArgsCallback? onDisconnected;
  WsMessageCallback? onMessage;

  WsConnectionState get connectionState => _connectionState;

  void connect(String serverUrl, String accessToken) {
    _wsUrl = _buildWsUrl(serverUrl);
    _accessToken = accessToken;
    _intentionalDisconnect = false;
    _authFailed = false;
    _reconnectAttempts = 0;
    _connectionState = WsConnectionState.connecting;
    _doConnect();
  }

  void disconnect() {
    _intentionalDisconnect = true;
    _connectionState = WsConnectionState.disconnected;
    _cleanup();
  }

  void send(WsClientMessage message) {
    if (_connectionState != WsConnectionState.connected) {
      _pendingMessages.add(jsonEncode(message.toJson()));
      return;
    }
    _channel?.sink.add(jsonEncode(message.toJson()));
  }

  void reconnect() {
    if (_wsUrl == null || _accessToken == null) return;
    _reconnectAttempts = 0;
    _authFailed = false;
    _connectionState = WsConnectionState.reconnecting;
    _cleanup();
    _doConnect();
  }

  void dispose() {
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();
    _cleanup();
    _disposed = true;
  }

  String _buildWsUrl(String serverUrl) {
    var wsUrl = normalizeUrl(serverUrl);
    wsUrl = wsUrl.replaceFirst(RegExp('^http'), 'ws');
    if (!wsUrl.endsWith('/ws')) wsUrl = '$wsUrl/ws';
    return wsUrl;
  }

  void _doConnect() {
    _cleanup();

    try {
      _channel = WebSocketChannel.connect(Uri.parse(_wsUrl!));
      send(WsAuth(accessToken: _accessToken!));
      _subscription = _channel!.stream.listen(
        _handleData,
        onError: _handleError,
        onDone: _handleDone,
      );
    } on Object {
      _scheduleReconnect();
    }
  }

  void _handleData(dynamic data) {
    try {
      final json = jsonDecode(data as String) as Map<String, dynamic>;
      final message = WsServerMessage.fromJson(json);

      switch (message) {
        case WsAuthRequired():
          send(WsAuth(accessToken: _accessToken!));
        case WsAuthOk():
          _reconnectAttempts = 0;
          _connectionState = WsConnectionState.connected;
          _flushPendingMessages();
          _startPing();
          onConnected?.call();
        case WsPong():
          break;
        case WsTokenChunk():
        case WsResponse():
        case WsError():
        case WsSessionSwitched():
        case WsUnknown():
          onMessage?.call(message);
      }
    } on Object catch (e) {
      debugPrint('[WebSocket] parse error: $e');
    }
  }

  void _flushPendingMessages() {
    for (final raw in _pendingMessages) {
      _channel?.sink.add(raw);
    }
    _pendingMessages.clear();
  }

  void _handleError(Object error) {
    _stopPing();
    _connectionState = WsConnectionState.disconnected;
    onDisconnected?.call();
    if (!_intentionalDisconnect && !_authFailed) {
      _scheduleReconnect();
    }
  }

  void _handleDone() {
    _stopPing();
    _connectionState = WsConnectionState.disconnected;
    onDisconnected?.call();
    if (!_intentionalDisconnect && !_authFailed) {
      _scheduleReconnect();
    }
  }

  void _startPing() {
    _stopPing();
    _pingTimer = Timer.periodic(_pingInterval, (_) {
      send(const WsPing());
    });
  }

  void _stopPing() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  void _scheduleReconnect() {
    if (_disposed) return;

    _reconnectTimer?.cancel();

    if (_reconnectAttempts >= _maxReconnectAttempts) {
      _connectionState = WsConnectionState.disconnected;
      onDisconnected?.call();
      return;
    }

    final jitter = Random().nextDouble() * 2;
    final delayMs =
        _baseReconnectDelay.inMilliseconds * (1 << _reconnectAttempts) * jitter;
    final clamped = delayMs.clamp(
      _baseReconnectDelay.inMilliseconds.toDouble(),
      _maxReconnectDelay.inMilliseconds.toDouble(),
    );

    _reconnectAttempts++;
    _connectionState = WsConnectionState.reconnecting;
    _reconnectTimer = Timer(Duration(milliseconds: clamped.toInt()), () {
      if (!_intentionalDisconnect && !_disposed) _doConnect();
    });
  }

  void _cleanup() {
    _stopPing();
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    unawaited(_subscription?.cancel());
    _subscription = null;
    unawaited(_channel?.sink.close());
    _channel = null;
  }
}
