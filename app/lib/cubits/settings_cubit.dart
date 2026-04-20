import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class SettingsState extends Equatable {
  final String? serverUrl;
  final String? currentModel;
  final List<String> availableModels;

  const SettingsState({
    this.serverUrl,
    this.currentModel,
    this.availableModels = const [],
  });

  SettingsState copyWith({
    String? serverUrl,
    String? currentModel,
    List<String>? availableModels,
  }) {
    return SettingsState(
      serverUrl: serverUrl ?? this.serverUrl,
      currentModel: currentModel ?? this.currentModel,
      availableModels: availableModels ?? this.availableModels,
    );
  }

  @override
  List<Object?> get props => [serverUrl, currentModel, availableModels];
}

class SettingsCubit extends Cubit<SettingsState> {
  SettingsCubit() : super(const SettingsState());

  void setServerUrl(String url) {
    emit(state.copyWith(serverUrl: url));
  }

  void setCurrentModel(String model) {
    emit(state.copyWith(currentModel: model));
  }

  void setAvailableModels(List<String> models) {
    emit(state.copyWith(availableModels: models));
  }
}
