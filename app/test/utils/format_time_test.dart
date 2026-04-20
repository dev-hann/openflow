import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/utils/format_time.dart';

void main() {
  group('formatTime', () {
    test('formats hour and minute with zero padding', () {
      expect(formatTime(DateTime(2025, 1, 1, 9, 5)), '09:05');
    });

    test('formats double-digit hours and minutes', () {
      expect(formatTime(DateTime(2025, 1, 1, 14, 30)), '14:30');
    });

    test('formats midnight', () {
      expect(formatTime(DateTime(2025)), '00:00');
    });

    test('formats end of day', () {
      expect(formatTime(DateTime(2025, 1, 1, 23, 59)), '23:59');
    });
  });

  group('formatRelativeTime', () {
    test('returns time for today', () {
      final now = DateTime.now();
      final result = formatRelativeTime(now);
      expect(result, contains(':'));
    });

    test('returns "어제" for yesterday', () {
      final yesterday = DateTime.now().subtract(const Duration(days: 1));
      expect(formatRelativeTime(yesterday), '어제');
    });

    test('returns "M월 D일" for older dates', () {
      final date = DateTime.now().subtract(const Duration(days: 5));
      final result = formatRelativeTime(date);
      expect(result, contains('월'));
      expect(result, contains('일'));
    });
  });
}
