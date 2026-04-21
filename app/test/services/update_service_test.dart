import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'package:openflow/services/update_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    PackageInfo.setMockInitialValues(
      appName: 'OpenFlow',
      packageName: 'com.example.openflow',
      version: '1.0.0',
      buildNumber: '1',
      buildSignature: '',
    );
  });

  group('UpdateService', () {
    late UpdateService service;

    setUp(() {
      service = UpdateService();
    });

    group('formatFileSize', () {
      test('formats bytes', () {
        expect(service.formatFileSize(0), '0 B');
        expect(service.formatFileSize(512), '512 B');
      });

      test('formats kilobytes', () {
        expect(service.formatFileSize(1024), '1.0 KB');
        expect(service.formatFileSize(1536), '1.5 KB');
      });

      test('formats megabytes', () {
        expect(service.formatFileSize(1048576), '1.0 MB');
        expect(service.formatFileSize(5242880), '5.0 MB');
      });
    });

    group('getCurrentVersion', () {
      test('returns version from package info', () async {
        final version = await service.getCurrentVersion();
        expect(version, '1.0.0');
      });
    });

    group('downloadApk', () {
      test('throws when no apk asset exists', () {
        final release = ReleaseInfo(
          tagName: 'v1.0.0',
          version: '1.0.0',
          releaseNotes: '',
          htmlUrl: '',
          assets: const [],
        );

        expect(
          () => service.downloadApk(release),
          throwsA(isA<Exception>()),
        );
      });
    });
  });
}
