import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/utils/user_friendly_error.dart';

void main() {
  group('toUserMessage', () {
    test('maps ApiError codes to user messages', () {
      expect(
        toUserMessage(
          const ApiError(
            status: 400,
            code: 'PROVIDER_AUTH_FAILED',
            message: 'bad key',
          ),
        ),
        'API Key가 올바르지 않습니다',
      );
      expect(
        toUserMessage(
          const ApiError(
            status: 404,
            code: 'SESSION_NOT_FOUND',
            message: 'nope',
          ),
        ),
        '세션을 찾을 수 없습니다',
      );
    });

    test('maps ApiException status codes to user messages', () {
      expect(
        toUserMessage(const ApiException(401, 'token expired')),
        '인증이 만료되었습니다. 다시 연결해주세요',
      );
      expect(
        toUserMessage(const ApiException(404, 'not found')),
        '요청한 리소스를 찾을 수 없습니다',
      );
      expect(
        toUserMessage(const ApiException(500, 'internal')),
        '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
      );
    });

    test('maps network errors to connection messages', () {
      expect(
        toUserMessage(Exception('SocketException: Connection refused')),
        '서버에 연결할 수 없습니다',
      );
      expect(
        toUserMessage(Exception('TimeoutException after 0:00:15')),
        '요청 시간이 초과되었습니다',
      );
    });

    test('returns generic message for unknown errors', () {
      final msg = toUserMessage(Exception('something weird'));
      expect(msg, '오류가 발생했습니다. 잠시 후 다시 시도해주세요');
    });
  });
}
