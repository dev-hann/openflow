import 'dart:async';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/protocol.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';

class AuthState extends Equatable {
  final StoredAuth? storedAuth;
  final bool isConnected;

  const AuthState({this.storedAuth, this.isConnected = false});

  AuthState copyWith({StoredAuth? storedAuth, bool? isConnected}) {
    return AuthState(
      storedAuth: storedAuth ?? this.storedAuth,
      isConnected: isConnected ?? this.isConnected,
    );
  }

  @override
  List<Object?> get props => [storedAuth, isConnected];
}

class AuthCubit extends Cubit<AuthState> {
  final AuthStorage storage;
  Completer<String>? _refreshCompleter;

  AuthCubit(this.storage) : super(const AuthState());

  Future<void> loadAuth() async {
    final auth = await storage.loadAuth();
    if (auth != null) {
      emit(state.copyWith(storedAuth: auth));
    }
  }

  void setStoredAuth(StoredAuth auth) {
    emit(state.copyWith(storedAuth: auth));
  }

  void setConnected(bool connected) {
    emit(state.copyWith(isConnected: connected));
  }

  Future<String?> getValidToken() async {
    final auth = state.storedAuth;
    if (auth == null) return null;

    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    _refreshCompleter = Completer<String>();
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
    } catch (e) {
      _refreshCompleter!.completeError(e);
      return null;
    } finally {
      _refreshCompleter = null;
    }
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
