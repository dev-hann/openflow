import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:openflow/models/protocol.dart';

class SessionsState extends Equatable {

  const SessionsState({this.sessions = const [], this.activeSessionId});
  final List<SessionInfo> sessions;
  final String? activeSessionId;

  SessionsState copyWith({
    List<SessionInfo>? sessions,
    String? activeSessionId,
    bool clearActive = false,
  }) {
    return SessionsState(
      sessions: sessions ?? this.sessions,
      activeSessionId: clearActive ? null : (activeSessionId ?? this.activeSessionId),
    );
  }

  @override
  List<Object?> get props => [sessions, activeSessionId];
}

class SessionsCubit extends Cubit<SessionsState> {
  SessionsCubit() : super(const SessionsState());

  void setSessions(List<SessionInfo> sessions) {
    emit(state.copyWith(sessions: sessions));
  }

  void setActiveSessionId(String? id) {
    if (id == null) {
      emit(state.copyWith(clearActive: true));
    } else {
      emit(state.copyWith(activeSessionId: id));
    }
  }

  void addSession(SessionInfo session) {
    emit(state.copyWith(
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
    ),);
  }

  void removeSession(String sessionId) {
    final sessions = state.sessions.where((s) => s.id != sessionId).toList();
    final activeId = state.activeSessionId == sessionId ? null : state.activeSessionId;
    emit(SessionsState(sessions: sessions, activeSessionId: activeId));
  }
}
