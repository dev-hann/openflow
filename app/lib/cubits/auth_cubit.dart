import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/models/protocol.dart';
import 'package:openflow/services/api_client.dart';
import 'package:openflow/services/auth_storage.dart';

class AuthState extends Equatable {
  const AuthState({
    this.storedAuth,
    this.isConnected = false,
    this.isLoading = false,
    this.errorMessage,
  });
  final StoredAuth? storedAuth;
  final bool isConnected;
  final bool isLoading;
  final String? errorMessage;

  AuthState copyWith({
    StoredAuth? storedAuth,
    bool? isConnected,
    bool? isLoading,
    String? errorMessage,
  }) {
    return AuthState(
      storedAuth: storedAuth ?? this.storedAuth,
      isConnected: isConnected ?? this.isConnected,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [storedAuth, isConnected, isLoading, errorMessage];
}

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this.storage) : super(const AuthState());
  final AuthStorage storage;
  Completer<String?>? _refreshCompleter;

  Future<void> loadAuth() async {
    emit(state.copyWith(isLoading: true));
    final auth = await storage.loadAuth();
    if (auth != null) {
      emit(state.copyWith(storedAuth: auth, isLoading: false));
    } else {
      emit(state.copyWith(isLoading: false));
    }
  }

  void setStoredAuth(StoredAuth auth) {
    emit(state.copyWith(storedAuth: auth));
  }

  void setConnected(bool connected) {
    emit(state.copyWith(isConnected: connected));
  }

  String? get currentAccessToken => state.storedAuth?.accessToken;

  Future<String?> getValidToken() async {
    final auth = state.storedAuth;
    if (auth == null) return null;
    final age = DateTime.now().millisecondsSinceEpoch -
        auth.pairedAt.millisecondsSinceEpoch;
    if (age > 50 * 60 * 1000) {
      return refreshIfNeeded();
    }
    return auth.accessToken;
  }

  Future<String?> refreshIfNeeded() async {
    final auth = state.storedAuth;
    if (auth == null) return null;

    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    _refreshCompleter = Completer<String?>();
    try {
      final api = createApiClient(auth.serverUrl);
      final tokens = await api.refreshToken(auth.refreshToken);
      final updated = StoredAuth(
        serverUrl: auth.serverUrl,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        pairedAt: auth.pairedAt,
      );
      await storage.saveAuth(updated);
      emit(state.copyWith(storedAuth: updated));
      _refreshCompleter!.complete(tokens.accessToken);
      return tokens.accessToken;
    } on Object catch (e) {
      emit(state.copyWith(errorMessage: e.toString()));
      _refreshCompleter!.complete(null);
      return null;
    } finally {
      _refreshCompleter = null;
    }
  }

  void clearError() {
    emit(state.copyWith());
  }

  Future<void> saveAuth(StoredAuth auth) async {
    await storage.saveAuth(auth);
    emit(state.copyWith(storedAuth: auth));
  }

  Future<void> clearAll() async {
    await storage.clearAuth();
    emit(const AuthState());
  }
}
