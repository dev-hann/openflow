import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/cubits/settings_cubit.dart';

void main() {
  group('SettingsCubit', () {
    late SettingsCubit cubit;

    setUp(() {
      cubit = SettingsCubit();
      addTearDown(cubit.close);
    });

    blocTest<SettingsCubit, SettingsState>(
      'initial state is empty',
      build: () => cubit,
      verify: (c) {
        expect(c.state.serverUrl, isNull);
      },
    );

    blocTest<SettingsCubit, SettingsState>(
      'setServerUrl updates url',
      build: () => cubit,
      act: (c) => c.setServerUrl('http://localhost:9800'),
      expect: () => [const SettingsState(serverUrl: 'http://localhost:9800')],
    );

    blocTest<SettingsCubit, SettingsState>(
      'clearServerUrl clears url',
      build: () => cubit,
      seed: () => const SettingsState(serverUrl: 'http://localhost:9800'),
      act: (c) => c.clearServerUrl(),
      expect: () => [const SettingsState()],
    );
  });
}
