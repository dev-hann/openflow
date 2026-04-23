import 'dart:io';

import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

class ReleaseAsset extends Equatable {
  const ReleaseAsset({
    required this.name,
    required this.downloadUrl,
    required this.size,
  });
  final String name;
  final String downloadUrl;
  final int size;

  @override
  List<Object?> get props => [name, downloadUrl, size];
}

class ReleaseInfo extends Equatable {
  const ReleaseInfo({
    required this.tagName,
    required this.version,
    required this.releaseNotes,
    required this.htmlUrl,
    required this.assets,
  });
  final String tagName;
  final String version;
  final String releaseNotes;
  final String htmlUrl;
  final List<ReleaseAsset> assets;

  @override
  List<Object?> get props => [tagName, version, releaseNotes, htmlUrl, assets];
}

class UpdateService {
  UpdateService({Dio? dio}) : _dio = dio ?? Dio();

  static const _owner = 'dev-hann';
  static const _repo = 'openflow';
  static const _githubApi = 'https://api.github.com';

  final Dio _dio;

  Future<String> getCurrentVersion() async {
    final info = await PackageInfo.fromPlatform();
    return info.version;
  }

  Future<ReleaseInfo?> checkForUpdate({String? currentVersion}) async {
    currentVersion ??= await getCurrentVersion();
    final latest = await _fetchLatestRelease();
    if (latest == null) return null;

    final comparison = _compareVersions(latest.version, currentVersion);
    if (comparison <= 0) return null;

    return latest;
  }

  Future<ReleaseInfo?> _fetchLatestRelease() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$_githubApi/repos/$_owner/$_repo/releases/latest',
        options: Options(
          headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'OpenFlow-App',
          },
        ),
      );

      final data = response.data;
      if (data == null) return null;
      final tagName = (data['tag_name'] as String?) ?? '';
      final version = tagName.replaceFirst(RegExp('^v'), '');
      final body = (data['body'] as String?) ?? '';
      final htmlUrl = (data['html_url'] as String?) ?? '';

      final assetsList = data['assets'] as List<dynamic>? ?? [];
      final assets = assetsList.map((a) {
        final asset = a as Map<String, dynamic>;
        return ReleaseAsset(
          name: (asset['name'] as String?) ?? '',
          downloadUrl: (asset['browser_download_url'] as String?) ?? '',
          size: (asset['size'] as int?) ?? 0,
        );
      }).toList();

      return ReleaseInfo(
        tagName: tagName,
        version: version,
        releaseNotes: body,
        htmlUrl: htmlUrl,
        assets: assets,
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw Exception('업데이트 확인 실패: ${e.message}');
    }
  }

  ReleaseAsset? _findArm64Apk(ReleaseInfo release) {
    return release.assets
        .where((a) => a.name.endsWith('.apk'))
        .where((a) => a.name.contains('arm64'))
        .firstOrNull;
  }

  Future<String> downloadApk(
    ReleaseInfo release, {
    void Function(int received, int total)? onProgress,
  }) async {
    final asset =
        _findArm64Apk(release) ??
        release.assets.where((a) => a.name.endsWith('.apk')).firstOrNull;

    if (asset == null) {
      throw Exception('다운로드 가능한 APK를 찾을 수 없습니다');
    }

    final dir = await getTemporaryDirectory();
    final filePath = '${dir.path}/${asset.name}';
    final file = File(filePath);

    if (file.existsSync()) {
      file.deleteSync();
    }

    await _dio.download(
      asset.downloadUrl,
      filePath,
      onReceiveProgress: onProgress,
    );

    return filePath;
  }

  String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  int _compareVersions(String a, String b) {
    final cleanA = a.split(RegExp('[-+]')).first;
    final cleanB = b.split(RegExp('[-+]')).first;
    final partsA = cleanA.split('.').map((s) => int.tryParse(s) ?? 0).toList();
    final partsB = cleanB.split('.').map((s) => int.tryParse(s) ?? 0).toList();

    for (var i = 0; i < partsA.length || i < partsB.length; i++) {
      final va = i < partsA.length ? partsA[i] : 0;
      final vb = i < partsB.length ? partsB[i] : 0;
      if (va != vb) return va.compareTo(vb);
    }
    return 0;
  }
}
