import 'package:openflow/services/api_client.dart';

String toUserMessage(Object error) {
  if (error is ApiError) {
    return switch (error.code) {
      'PROVIDER_AUTH_FAILED' => 'API Key가 올바르지 않습니다',
      'PROVIDER_NOT_FOUND' => 'Provider를 찾을 수 없습니다',
      'PROVIDER_CONNECTION_FAILED' => 'Provider에 연결할 수 없습니다',
      'SESSION_NOT_FOUND' => '세션을 찾을 수 없습니다',
      'INVALID_TOKEN' || 'TOKEN_EXPIRED' => '인증이 만료되었습니다. 다시 연결해주세요',
      'PAIR_INVALID_PIN' => 'PIN이 올바르지 않습니다',
      'UNAUTHORIZED' => '인증이 필요합니다',
      _ => '요청을 처리할 수 없습니다 (${error.code})',
    };
  }
  if (error is ApiException) {
    return switch (error.statusCode) {
      401 => '인증이 만료되었습니다. 다시 연결해주세요',
      403 => '접근 권한이 없습니다',
      404 => '요청한 리소스를 찾을 수 없습니다',
      >= 500 => '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
      _ => '요청을 처리할 수 없습니다',
    };
  }
  if (error is FormatException) {
    return '데이터 형식이 올바르지 않습니다';
  }
  final msg = error.toString();
  if (msg.contains('SocketException') || msg.contains('Connection refused')) {
    return '서버에 연결할 수 없습니다';
  }
  if (msg.contains('TimeoutException') || msg.contains('timed out')) {
    return '요청 시간이 초과되었습니다';
  }
  return '오류가 발생했습니다. 잠시 후 다시 시도해주세요';
}
