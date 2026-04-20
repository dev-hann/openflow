import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/models/protocol.dart';

class ProvidersState extends Equatable {
  const ProvidersState({
    this.providers = const [],
    this.activeProviderId,
    this.isSwitching = false,
  });
  final List<ProviderInfo> providers;
  final String? activeProviderId;
  final bool isSwitching;

  ProvidersState copyWith({
    List<ProviderInfo>? providers,
    String? activeProviderId,
    bool clearActive = false,
    bool? isSwitching,
  }) {
    return ProvidersState(
      providers: providers ?? this.providers,
      activeProviderId:
          clearActive ? null : (activeProviderId ?? this.activeProviderId),
      isSwitching: isSwitching ?? this.isSwitching,
    );
  }

  @override
  List<Object?> get props => [providers, activeProviderId, isSwitching];
}

class ProvidersCubit extends Cubit<ProvidersState> {
  ProvidersCubit() : super(const ProvidersState());

  void setProviders(List<ProviderInfo> providers) {
    final active = providers.where((p) => p.isActive).firstOrNull;
    emit(
      state.copyWith(
        providers: providers,
        activeProviderId: active?.id ?? state.activeProviderId,
      ),
    );
  }

  void setActiveProviderId(String id) {
    emit(state.copyWith(activeProviderId: id));
  }

  void setSwitching(bool switching) {
    emit(state.copyWith(isSwitching: switching));
  }

  void updateProvider(ProviderInfo updated) {
    final providers =
        state.providers.map((p) => p.id == updated.id ? updated : p).toList();
    emit(state.copyWith(providers: providers));
  }
}
