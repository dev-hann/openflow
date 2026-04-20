import 'dart:async';
import 'dart:convert';

import 'package:openflow/models/protocol.dart';
import 'package:openflow/utils/normalize_url.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

typedef WsMessageCallback = void Function(WsServerMessage);
typedef NoArgsCallback = void Function();

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

  static const _baseReconnectDelay = Duration(seconds: 1);
  static const _maxReconnectDelay = Duration(seconds: 30);
  static const _pingInterval = Duration(seconds: 30);

  NoArgsCallback? onConnected;
  NoArgsCallback? onDisconnected;
  WsMessageCallback? onMessage;

  bool get isConnected => _channel != null;

  void connect(String serverUrl, String accessToken) {
    _wsUrl = _buildWsUrl(serverUrl);
    _accessToken = accessToken;
    _intentionalDisconnect = false;
    _authFailed = false;
    _reconnectAttempts = 0;
    _doConnect();
  }

  void disconnect() {
    _intentionalDisconnect = true;
    _cleanup();
  }

  void send(WsClientMessage message) {
    _channel?.sink.add(jsonEncode(message.toJson()));
  }

  void reconnect() {
    if (_wsUrl == null || _accessToken == null) return;
    _reconnectAttempts = 0;
    _authFailed = false;
    _cleanup();
    _doConnect();
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
          _startPing();
          onConnected?.call();
        case WsPong():
          break;
        default:
          onMessage?.call(message);
      }
    } on Object {
      // Ignore malformed messages
    }
  }

  void _handleError(Object error) {
    _stopPing();
    onDisconnected?.call();
    if (!_intentionalDisconnect && !_authFailed) {
      _scheduleReconnect();
    }
  }

  void _handleDone() {
    _stopPing();
    onDisconnected?.call();
    if (!_intentionalDisconnect && !_authFailed) {
      _scheduleReconnect();
    }
  }

  void _startPing() {
    _stopPing();
    _pingTimer = Timer.periodic(_pingInterval, (_) {
      send(WsPing());
    });
  }

  void _stopPing() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();

    final jitter = 1 + _reconnectAttempts * 0.2;
    final delayMs =
        _baseReconnectDelay.inMilliseconds * (1 << _reconnectAttempts) * jitter;
    final clamped = delayMs.clamp(
      _baseReconnectDelay.inMilliseconds.toDouble(),
      _maxReconnectDelay.inMilliseconds.toDouble(),
    );

    _reconnectAttempts++;
    _reconnectTimer = Timer(Duration(milliseconds: clamped.toInt()), () {
      if (!_intentionalDisconnect) _doConnect();
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
