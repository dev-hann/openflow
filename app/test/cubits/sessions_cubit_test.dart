import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openflow/cubits/sessions_cubit.dart';
import 'package:openflow/models/protocol.dart';

SessionInfo _session(String id, {String title = 'Test'}) {
  return SessionInfo(
    id: id,
    title: title,
    createdAt: DateTime(2025),
  );
}

void main() {
  group('SessionsCubit', () {
    late SessionsCubit cubit;

    setUp(() {
      cubit = SessionsCubit();
      addTearDown(cubit.close);
    });

    blocTest<SessionsCubit, SessionsState>(
      'initial state is empty',
      build: () => cubit,
      verify: (c) {
        expect(c.state.sessions, isEmpty);
        expect(c.state.activeSessionId, isNull);
      },
    );

    blocTest<SessionsCubit, SessionsState>(
      'setSessions replaces sessions',
      build: () => cubit,
      act: (c) {
        c.setSessions([_session('s1'), _session('s2')]);
      },
      expect: () => [
        SessionsState(sessions: [_session('s1'), _session('s2')]),
      ],
    );

    blocTest<SessionsCubit, SessionsState>(
      'setActiveSessionId sets active session',
      build: () => cubit,
      act: (c) {
        c.setActiveSessionId('s1');
      },
      expect: () => [
        const SessionsState(activeSessionId: 's1'),
      ],
    );

    blocTest<SessionsCubit, SessionsState>(
      'setActiveSessionId with null clears active',
      build: () => cubit,
      seed: () => const SessionsState(activeSessionId: 's1'),
      act: (c) {
        c.setActiveSessionId(null);
      },
      expect: () => [const SessionsState()],
    );

    blocTest<SessionsCubit, SessionsState>(
      'addSession prepends and sets active',
      build: () => cubit,
      seed: () => SessionsState(sessions: [_session('s1')]),
      act: (c) {
        c.addSession(_session('s2'));
      },
      expect: () => [
        SessionsState(
          sessions: [_session('s2'), _session('s1')],
          activeSessionId: 's2',
        ),
      ],
    );

    blocTest<SessionsCubit, SessionsState>(
      'removeSession removes and clears active if removed',
      build: () => cubit,
      seed: () => SessionsState(
        sessions: [_session('s1'), _session('s2')],
        activeSessionId: 's1',
      ),
      act: (c) {
        c.removeSession('s1');
      },
      expect: () => [
        SessionsState(
          sessions: [_session('s2')],
        ),
      ],
    );

    blocTest<SessionsCubit, SessionsState>(
      'removeSession keeps active if different session removed',
      build: () => cubit,
      seed: () => SessionsState(
        sessions: [_session('s1'), _session('s2')],
        activeSessionId: 's1',
      ),
      act: (c) {
        c.removeSession('s2');
      },
      expect: () => [
        SessionsState(
          sessions: [_session('s1')],
          activeSessionId: 's1',
        ),
      ],
    );
  });
}
