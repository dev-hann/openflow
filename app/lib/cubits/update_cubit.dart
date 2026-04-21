import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:openflow/services/update_service.dart';

class UpdateState extends Equatable {
  const UpdateState({
    this.currentVersion = '',
    this.status = UpdateStatus.idle,
    this.release,
    this.downloadProgress = 0,
    this.downloadedFilePath,
    this.errorMessage,
  });

  final String currentVersion;
  final UpdateStatus status;
  final ReleaseInfo? release;
  final int downloadProgress;
  final String? downloadedFilePath;
  final String? errorMessage;

  UpdateState copyWith({
    String? currentVersion,
    UpdateStatus? status,
    ReleaseInfo? release,
    int? downloadProgress,
    String? downloadedFilePath,
    String? errorMessage,
    bool clearError = false,
    bool clearDownloadedFile = false,
  }) {
    return UpdateState(
      currentVersion: currentVersion ?? this.currentVersion,
      status: status ?? this.status,
      release: release ?? this.release,
      downloadProgress: downloadProgress ?? this.downloadProgress,
      downloadedFilePath: clearDownloadedFile
          ? null
          : (downloadedFilePath ?? this.downloadedFilePath),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [
        currentVersion,
        status,
        release,
        downloadProgress,
        downloadedFilePath,
        errorMessage,
      ];
}

enum UpdateStatus {
  idle,
  checking,
  upToDate,
  available,
  downloading,
  readyToInstall,
  error,
}

class UpdateCubit extends Cubit<UpdateState> {
  UpdateCubit(this._updateService) : super(const UpdateState());

  final UpdateService _updateService;

  Future<void> loadCurrentVersion() async {
    final version = await _updateService.getCurrentVersion();
    emit(state.copyWith(currentVersion: version));
  }

  Future<void> checkForUpdate() async {
    emit(state.copyWith(status: UpdateStatus.checking, clearError: true));
    try {
      final release = await _updateService.checkForUpdate();
      if (release != null) {
        emit(state.copyWith(
          status: UpdateStatus.available,
          release: release,
        ));
      } else {
        emit(state.copyWith(status: UpdateStatus.upToDate));
      }
    } on Object catch (e) {
      emit(state.copyWith(
        status: UpdateStatus.error,
        errorMessage: e.toString(),
      ));
    }
  }

  Future<void> downloadUpdate() async {
    final release = state.release;
    if (release == null) return;

    emit(state.copyWith(
      status: UpdateStatus.downloading,
      downloadProgress: 0,
      clearError: true,
      clearDownloadedFile: true,
    ));

    try {
      final filePath = await _updateService.downloadApk(
        release,
        onProgress: (received, total) {
          if (total > 0) {
            final progress = ((received / total) * 100).round();
            emit(state.copyWith(downloadProgress: progress));
          }
        },
      );
      emit(state.copyWith(
        status: UpdateStatus.readyToInstall,
        downloadedFilePath: filePath,
      ));
    } on Object catch (e) {
      emit(state.copyWith(
        status: UpdateStatus.error,
        errorMessage: e.toString(),
      ));
    }
  }

  void reset() {
    emit(UpdateState(currentVersion: state.currentVersion));
  }
}
