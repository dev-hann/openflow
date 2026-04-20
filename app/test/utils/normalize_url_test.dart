import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/utils/normalize_url.dart';

void main() {
  group('normalizeUrl', () {
    test('returns empty string for empty input', () {
      expect(normalizeUrl(''), '');
    });

    test('trims whitespace', () {
      expect(normalizeUrl('  http://example.com  '), 'http://example.com');
    });

    test('adds http:// when no scheme', () {
      expect(normalizeUrl('example.com'), 'http://example.com');
    });

    test('preserves https:// scheme', () {
      expect(normalizeUrl('https://example.com'), 'https://example.com');
    });

    test('preserves http:// scheme', () {
      expect(normalizeUrl('http://example.com'), 'http://example.com');
    });

    test('removes trailing slashes', () {
      expect(normalizeUrl('http://example.com/'), 'http://example.com');
    });

    test('removes multiple trailing slashes', () {
      expect(normalizeUrl('http://example.com///'), 'http://example.com');
    });

    test('preserves port', () {
      expect(normalizeUrl('192.168.1.100:9800'), 'http://192.168.1.100:9800');
    });

    test('preserves path segments', () {
      expect(
        normalizeUrl('http://example.com/api/v1'),
        'http://example.com/api/v1',
      );
    });

    test('collapses duplicate slashes in path', () {
      expect(
        normalizeUrl('http://example.com//api///v1'),
        'http://example.com/api/v1',
      );
    });

    test('handles ip with port and no scheme', () {
      expect(
        normalizeUrl('10.0.0.1:3000'),
        'http://10.0.0.1:3000',
      );
    });

    test('handles whitespace-only input', () {
      expect(normalizeUrl('   '), '');
    });
  });
}
