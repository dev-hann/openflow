import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:openflow/cubits/update_cubit.dart';
import 'package:openflow/services/update_service.dart';

class MockUpdateService extends Mock implements UpdateService {}

void main() {
  group('UpdateCubit', () {
    late UpdateCubit cubit;
    late MockUpdateService mockService;

    setUp(() {
      mockService = MockUpdateService();
      when(() => mockService.getCurrentVersion())
          .thenAnswer((_) async => '1.0.0');
      when(() => mockService.checkForUpdate()).thenAnswer((_) async => null);
      cubit = UpdateCubit(mockService);
      addTearDown(cubit.close);
    });

    blocTest<UpdateCubit, UpdateState>(
      'initial state is idle',
      build: () => cubit,
      verify: (c) {
        expect(c.state.status, UpdateStatus.idle);
        expect(c.state.currentVersion, '');
        expect(c.state.release, isNull);
        expect(c.state.errorMessage, isNull);
      },
    );

    blocTest<UpdateCubit, UpdateState>(
      'loadCurrentVersion updates currentVersion',
      build: () => cubit,
      act: (c) => c.loadCurrentVersion(),
      expect: () => [
        const UpdateState(currentVersion: '1.0.0'),
      ],
      verify: (_) {
        verify(() => mockService.getCurrentVersion()).called(1);
      },
    );

    blocTest<UpdateCubit, UpdateState>(
      'checkForUpdate finds update',
      build: () => cubit,
      setUp: () {
        final release = ReleaseInfo(
          tagName: 'v1.1.0',
          version: '1.1.0',
          releaseNotes: 'Bug fixes',
          htmlUrl: 'https://github.com/test/release',
          assets: [
            ReleaseAsset(
              name: 'app-arm64.apk',
              downloadUrl: 'https://example.com/app.apk',
              size: 1024,
            ),
          ],
        );
        when(() => mockService.checkForUpdate())
            .thenAnswer((_) async => release);
      },
      act: (c) => c.checkForUpdate(),
      expect: () => [
        const UpdateState(currentVersion: '1.0.0'),
        const UpdateState(currentVersion: '1.0.0', status: UpdateStatus.checking, errorMessage: null),
        UpdateState(
          currentVersion: '1.0.0',
          status: UpdateStatus.available,
          release: ReleaseInfo(
            tagName: 'v1.1.0',
            version: '1.1.0',
            releaseNotes: 'Bug fixes',
            htmlUrl: 'https://github.com/test/release',
            assets: [
              ReleaseAsset(
                name: 'app-arm64.apk',
                downloadUrl: 'https://example.com/app.apk',
                size: 1024,
              ),
            ],
          ),
        ),
      ],
    );

    blocTest<UpdateCubit, UpdateState>(
      'checkForUpdate reports up to date',
      build: () => cubit,
      act: (c) => c.checkForUpdate(),
      expect: () => [
        const UpdateState(currentVersion: '1.0.0'),
        const UpdateState(currentVersion: '1.0.0', status: UpdateStatus.checking, errorMessage: null),
        const UpdateState(currentVersion: '1.0.0', status: UpdateStatus.upToDate),
      ],
    );

    blocTest<UpdateCubit, UpdateState>(
      'checkForUpdate handles error',
      build: () => cubit,
      setUp: () {
        when(() => mockService.checkForUpdate())
            .thenThrow(Exception('network error'));
      },
      act: (c) => c.checkForUpdate(),
      expect: () => [
        const UpdateState(currentVersion: '1.0.0'),
        const UpdateState(currentVersion: '1.0.0', status: UpdateStatus.checking, errorMessage: null),
        const UpdateState(
          currentVersion: '1.0.0',
          status: UpdateStatus.error,
          errorMessage: 'Exception: network error',
        ),
      ],
    );

    blocTest<UpdateCubit, UpdateState>(
      'reset clears state keeping currentVersion',
      build: () => cubit,
      seed: () => UpdateState(
        currentVersion: '1.0.0',
        status: UpdateStatus.error,
        errorMessage: 'some error',
      ),
      act: (c) => c.reset(),
      expect: () => [
        const UpdateState(currentVersion: '1.0.0'),
      ],
    );
  });
}
