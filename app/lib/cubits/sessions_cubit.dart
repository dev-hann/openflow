import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/models/protocol.dart';

class SessionsState extends Equatable {
  const SessionsState({
    this.sessions = const [],
    this.activeSessionId,
    this.isLoading = false,
    this.errorMessage,
  });
  final List<SessionInfo> sessions;
  final String? activeSessionId;
  final bool isLoading;
  final String? errorMessage;

  SessionsState copyWith({
    List<SessionInfo>? sessions,
    String? activeSessionId,
    bool clearActive = false,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return SessionsState(
      sessions: sessions ?? this.sessions,
      activeSessionId:
          clearActive ? null : (activeSessionId ?? this.activeSessionId),
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [sessions, activeSessionId, isLoading, errorMessage];
}

class SessionsCubit extends Cubit<SessionsState> {
  SessionsCubit() : super(const SessionsState());

  void setLoading() {
    emit(state.copyWith(isLoading: true, clearError: true));
  }

  void setError(String message) {
    emit(state.copyWith(isLoading: false, errorMessage: message));
  }

  void clearError() {
    emit(state.copyWith(clearError: true));
  }

  void setSessions(List<SessionInfo> sessions) {
    emit(state.copyWith(sessions: sessions, isLoading: false, clearError: true));
  }

  void setActiveSessionId(String? id) {
    if (id == null) {
      emit(state.copyWith(clearActive: true));
    } else {
      emit(state.copyWith(activeSessionId: id));
    }
  }

  void addSession(SessionInfo session) {
    if (state.sessions.any((s) => s.id == session.id)) return;
    emit(
      state.copyWith(
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
      ),
    );
  }

  void removeSession(String sessionId) {
    final sessions = List<SessionInfo>.from(state.sessions)
      ..removeWhere((s) => s.id == sessionId);
    var activeId = state.activeSessionId;
    if (activeId == sessionId) {
      activeId = sessions.isNotEmpty ? sessions.first.id : null;
    }
    emit(SessionsState(
      sessions: sessions,
      activeSessionId: activeId,
    ));
  }
}
