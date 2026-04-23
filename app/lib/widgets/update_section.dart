import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:open_filex/open_filex.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:openflow/config/design_tokens.dart';
import 'package:openflow/cubits/update_cubit.dart';
import 'package:openflow/services/update_service.dart';

class UpdateSection extends StatelessWidget {
  const UpdateSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<UpdateCubit, UpdateState>(
      builder: (context, updateState) {
        final updateCubit = context.read<UpdateCubit>();

        return Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xl,
          ),
          child: Column(
            children: [
              _buildVersionText(context, updateState),
              const SizedBox(height: AppSpacing.sm),
              _buildUpdateAction(context, updateState, updateCubit),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVersionText(BuildContext context, UpdateState updateState) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Text(
      'OpenFlow v${updateState.currentVersion}',
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: colorScheme.border,
          ),
    );
  }

  Widget _buildUpdateAction(
    BuildContext context,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    switch (updateState.status) {
      case UpdateStatus.idle:
        return ShadButton.ghost(
          onPressed: updateCubit.checkForUpdate,
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.system_update_outlined, size: 18),
              SizedBox(width: 4),
              Text('업데이트 확인'),
            ],
          ),
        );

      case UpdateStatus.checking:
        return const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        );

      case UpdateStatus.upToDate:
        return Text(
          '최신 버전입니다',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: const Color(0xFF22C55E),
              ),
        );

      case UpdateStatus.available:
        return _buildUpdateAvailable(context, updateState, updateCubit);

      case UpdateStatus.downloading:
        return _buildDownloadProgress(context, updateState);

      case UpdateStatus.readyToInstall:
        return _buildInstallButton(context, updateState, updateCubit);

      case UpdateStatus.error:
        return _buildErrorAction(context, updateState, updateCubit);
    }
  }

  Widget _buildErrorAction(
    BuildContext context,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Column(
      children: [
        Text(
          updateState.errorMessage ?? '오류가 발생했습니다',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colorScheme.destructive,
              ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xs),
        ShadButton.ghost(
          onPressed: updateCubit.checkForUpdate,
          child: const Text('다시 시도'),
        ),
      ],
    );
  }

  Widget _buildUpdateAvailable(
    BuildContext context,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    final release = updateState.release!;
    final updateService = context.read<UpdateService>();
    final asset = release.assets
        .where((a) => a.name.endsWith('.apk'))
        .where((a) => a.name.contains('arm64'))
        .firstOrNull;
    final sizeText =
        asset != null ? updateService.formatFileSize(asset.size) : '';

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colorScheme.secondary.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: colorScheme.primary.withValues(alpha: 0.3),
            ),
          ),
          child: _buildReleaseDetails(context, release, sizeText),
        ),
        const SizedBox(height: AppSpacing.sm),
        _buildUpdateActions(context, updateCubit, release),
      ],
    );
  }

  Widget _buildReleaseDetails(
    BuildContext context,
    ReleaseInfo release,
    String sizeText,
  ) {
    final colorScheme = ShadTheme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.new_releases_outlined,
              size: 18,
              color: colorScheme.primary,
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              '${release.tagName} 사용 가능',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colorScheme.primary,
                  ),
            ),
            if (sizeText.isNotEmpty) ...[
              const Spacer(),
              Text(
                sizeText,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: colorScheme.mutedForeground,
                    ),
              ),
            ],
          ],
        ),
        if (release.releaseNotes.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            release.releaseNotes,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colorScheme.mutedForeground,
                ),
            maxLines: 5,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }

  Widget _buildUpdateActions(
    BuildContext context,
    UpdateCubit updateCubit,
    ReleaseInfo release,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        ShadButton(
          onPressed: updateCubit.downloadUpdate,
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.download, size: 18),
              SizedBox(width: 4),
              Text('업데이트'),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        ShadButton.ghost(
          onPressed: () => _openReleasePage(release.htmlUrl),
          child: const Text('릴리즈 페이지'),
        ),
      ],
    );
  }

  Widget _buildDownloadProgress(BuildContext context, UpdateState updateState) {
    return Column(
      children: [
        Text(
          '다운로드 중... ${updateState.downloadProgress}%',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: AppSpacing.xs),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: ShadProgress(
            value: updateState.downloadProgress / 100,
          ),
        ),
      ],
    );
  }

  Widget _buildInstallButton(
    BuildContext context,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    return Column(
      children: [
        ShadButton(
          onPressed: () =>
              _installApk(context, updateState.downloadedFilePath!),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.install_mobile, size: 18),
              SizedBox(width: 4),
              Text('설치'),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          '다운로드 완료',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: const Color(0xFF22C55E),
              ),
        ),
      ],
    );
  }

  Future<void> _installApk(BuildContext context, String filePath) async {
    try {
      await OpenFilex.open(filePath);
    } on Object {
      final release = context.read<UpdateCubit>().state.release;
      if (release != null) {
        await _openReleasePage(release.htmlUrl);
      }
    }
  }

  Future<void> _openReleasePage(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
