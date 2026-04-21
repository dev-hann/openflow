import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/cubits/providers_cubit.dart';
import 'package:openflow/models/protocol.dart';

ProviderInfo _provider(String id, {bool isActive = false}) {
  return ProviderInfo(
    id: id,
    name: 'Provider $id',
    baseUrl: 'http://localhost',
    model: 'test-model',
    isActive: isActive,
    createdAt: DateTime(2025),
  );
}

void main() {
  group('ProvidersCubit', () {
    late ProvidersCubit cubit;

    setUp(() {
      cubit = ProvidersCubit();
      addTearDown(cubit.close);
    });

    blocTest<ProvidersCubit, ProvidersState>(
      'initial state is empty',
      build: () => cubit,
      verify: (c) {
        expect(c.state.providers, isEmpty);
        expect(c.state.activeProviderId, isNull);
        expect(c.state.isSwitching, false);
      },
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'setProviders detects active provider',
      build: () => cubit,
      act: (c) {
        c.setProviders(
          [
            _provider('p1'),
            _provider('p2', isActive: true),
          ],
        );
      },
      expect: () => [
        ProvidersState(
          providers: [_provider('p1'), _provider('p2', isActive: true)],
          activeProviderId: 'p2',
        ),
      ],
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'setProviders keeps existing active if none active in list',
      build: () => cubit,
      seed: () => const ProvidersState(activeProviderId: 'p0'),
      act: (c) {
        c.setProviders([_provider('p1')]);
      },
      expect: () => [
        ProvidersState(
          providers: [_provider('p1')],
          activeProviderId: 'p0',
        ),
      ],
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'setActiveProviderId updates active',
      build: () => cubit,
      act: (c) {
        c.setActiveProviderId('p1');
      },
      expect: () => [
        const ProvidersState(activeProviderId: 'p1'),
      ],
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'setSwitching updates switching state',
      build: () => cubit,
      act: (c) {
        c.setSwitching(true);
      },
      expect: () => [const ProvidersState(isSwitching: true)],
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'updateProvider replaces matching provider',
      build: () => cubit,
      seed: () => ProvidersState(
        providers: [
          _provider('p1'),
          _provider('p2'),
        ],
      ),
      act: (c) {
        c.updateProvider(_provider('p1', isActive: true));
      },
      expect: () => [
        ProvidersState(
          providers: [
            _provider('p1', isActive: true),
            _provider('p2'),
          ],
        ),
      ],
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'removeProvider removes matching provider',
      build: () => cubit,
      seed: () => ProvidersState(
        providers: [
          _provider('p1'),
          _provider('p2'),
          _provider('p3'),
        ],
        activeProviderId: 'p1',
      ),
      act: (c) {
        c.removeProvider('p2');
      },
      expect: () => [
        ProvidersState(
          providers: [
            _provider('p1'),
            _provider('p3'),
          ],
          activeProviderId: 'p1',
        ),
      ],
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'removeProvider clears active when active removed',
      build: () => cubit,
      seed: () => ProvidersState(
        providers: [
          _provider('p1'),
          _provider('p2'),
        ],
        activeProviderId: 'p1',
      ),
      act: (c) {
        c.removeProvider('p1');
      },
      expect: () => [
        ProvidersState(
          providers: [_provider('p2')],
        ),
      ],
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'setAvailableModels updates models and clears loading',
      build: () => cubit,
      seed: () => const ProvidersState(isLoadingModels: true),
      act: (c) {
        c.setAvailableModels(['gpt-4', 'gpt-3.5']);
      },
      expect: () => [
        const ProvidersState(
          availableModels: ['gpt-4', 'gpt-3.5'],
        ),
      ],
    );

    blocTest<ProvidersCubit, ProvidersState>(
      'setLoadingModels updates loading state',
      build: () => cubit,
      act: (c) {
        c.setLoadingModels(true);
      },
      expect: () => [const ProvidersState(isLoadingModels: true)],
    );
  });
}
