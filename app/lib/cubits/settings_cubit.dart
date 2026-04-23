import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class SettingsState extends Equatable {
  const SettingsState({this.serverUrl});
  final String? serverUrl;

  SettingsState copyWith({String? serverUrl, bool clearServerUrl = false}) {
    return SettingsState(
      serverUrl: clearServerUrl ? null : (serverUrl ?? this.serverUrl),
    );
  }

  @override
  List<Object?> get props => [serverUrl];
}

class SettingsCubit extends Cubit<SettingsState> {
  SettingsCubit() : super(const SettingsState());

  void setServerUrl(String url) {
    emit(state.copyWith(serverUrl: url));
  }

  void clearServerUrl() {
    emit(state.copyWith(clearServerUrl: true));
  }
}
