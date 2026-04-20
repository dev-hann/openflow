import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/cubits/auth_cubit.dart';
import 'package:openflow/models/protocol.dart';
import 'package:openflow/services/auth_storage.dart';

class MockAuthStorage implements AuthStorage {
  StoredAuth? _stored;

  @override
  Future<void> saveAuth(StoredAuth auth) async {
    _stored = auth;
  }

  @override
  Future<StoredAuth?> loadAuth() async => _stored;

  @override
  Future<void> clearAuth() async {
    _stored = null;
  }
}

StoredAuth _testAuth({
  String serverUrl = 'http://localhost:9800',
  String accessToken = 'at_test',
  String refreshToken = 'rt_test',
}) {
  return StoredAuth(
    serverUrl: serverUrl,
    accessToken: accessToken,
    refreshToken: refreshToken,
    pairedAt: DateTime(2025),
  );
}

void main() {
  group('AuthCubit', () {
    late MockAuthStorage storage;
    late AuthCubit cubit;

    setUp(() {
      storage = MockAuthStorage();
      cubit = AuthCubit(storage);
      addTearDown(cubit.close);
    });

    blocTest<AuthCubit, AuthState>(
      'initial state has no auth and is disconnected',
      build: () => cubit,
      verify: (c) {
        expect(c.state.storedAuth, isNull);
        expect(c.state.isConnected, false);
      },
    );

    blocTest<AuthCubit, AuthState>(
      'loadAuth loads from storage',
      build: () => cubit,
      act: (c) async {
        await storage.saveAuth(_testAuth());
        await c.loadAuth();
      },
      expect: () => [
        AuthState(storedAuth: _testAuth()),
      ],
    );

    blocTest<AuthCubit, AuthState>(
      'loadAuth does nothing when storage is empty',
      build: () => cubit,
      act: (c) async {
        await c.loadAuth();
      },
      expect: () => <AuthState>[],
    );

    blocTest<AuthCubit, AuthState>(
      'setStoredAuth updates state',
      build: () => cubit,
      act: (c) {
        c.setStoredAuth(_testAuth());
      },
      expect: () => [
        AuthState(storedAuth: _testAuth()),
      ],
    );

    blocTest<AuthCubit, AuthState>(
      'setConnected updates connection state',
      build: () => cubit,
      act: (c) {
        c.setConnected(true);
      },
      expect: () => [
        const AuthState(isConnected: true),
      ],
    );

    blocTest<AuthCubit, AuthState>(
      'saveAuth persists and updates state',
      build: () => cubit,
      act: (c) async {
        await c.saveAuth(_testAuth());
      },
      expect: () => [
        AuthState(storedAuth: _testAuth()),
      ],
    );

    blocTest<AuthCubit, AuthState>(
      'clearAll clears state and storage',
      build: () => cubit,
      seed: () => AuthState(storedAuth: _testAuth(), isConnected: true),
      act: (c) async {
        await c.clearAll();
      },
      expect: () => [const AuthState()],
    );
  });
}
