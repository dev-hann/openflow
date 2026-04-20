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
        expect(c.state.currentModel, isNull);
        expect(c.state.availableModels, isEmpty);
      },
    );

    blocTest<SettingsCubit, SettingsState>(
      'setServerUrl updates url',
      build: () => cubit,
      act: (c) => c.setServerUrl('http://localhost:9800'),
      expect: () => [
        const SettingsState(serverUrl: 'http://localhost:9800'),
      ],
    );

    blocTest<SettingsCubit, SettingsState>(
      'setCurrentModel updates model',
      build: () => cubit,
      act: (c) => c.setCurrentModel('gpt-4o'),
      expect: () => [
        const SettingsState(currentModel: 'gpt-4o'),
      ],
    );

    blocTest<SettingsCubit, SettingsState>(
      'setAvailableModels updates models list',
      build: () => cubit,
      act: (c) => c.setAvailableModels(['gpt-4o', 'claude-3']),
      expect: () => [
        const SettingsState(availableModels: ['gpt-4o', 'claude-3']),
      ],
    );
  });
}
