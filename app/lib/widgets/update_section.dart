import 'package:flutter/material.dart';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:open_filex/open_filex.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/cubits/update_cubit.dart';
import 'package:openflow/services/update_service.dart';

class UpdateSection extends StatelessWidget {
  const UpdateSection({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return BlocBuilder<UpdateCubit, UpdateState>(
      builder: (context, updateState) {
        final updateCubit = context.read<UpdateCubit>();

        return Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.md,
            vertical: Spacing.xl,
          ),
          child: Column(
            children: [
              Text(
                'OpenFlow v${updateState.currentVersion}',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
              const SizedBox(height: Spacing.sm),
              _buildUpdateAction(context, theme, updateState, updateCubit),
            ],
          ),
        );
      },
    );
  }

  Widget _buildUpdateAction(
    BuildContext context,
    ThemeData theme,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    switch (updateState.status) {
      case UpdateStatus.idle:
        return TextButton.icon(
          onPressed: updateCubit.checkForUpdate,
          icon: const Icon(Icons.system_update_outlined, size: 18),
          label: const Text('업데이트 확인'),
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
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.tertiary,
          ),
        );

      case UpdateStatus.available:
        return _buildUpdateAvailable(context, theme, updateState, updateCubit);

      case UpdateStatus.downloading:
        return _buildDownloadProgress(theme, updateState);

      case UpdateStatus.readyToInstall:
        return _buildInstallButton(context, theme, updateState, updateCubit);

      case UpdateStatus.error:
        return Column(
          children: [
            Text(
              updateState.errorMessage ?? '오류가 발생했습니다',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: Spacing.xs),
            TextButton(
              onPressed: updateCubit.reset,
              child: const Text('다시 시도'),
            ),
          ],
        );
    }
  }

  Widget _buildUpdateAvailable(
    BuildContext context,
    ThemeData theme,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
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
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: theme.colorScheme.primary.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.new_releases_outlined,
                    size: 18,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: Spacing.xs),
                  Text(
                    '${release.tagName} 사용 가능',
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  if (sizeText.isNotEmpty) ...[
                    const Spacer(),
                    Text(
                      sizeText,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
              if (release.releaseNotes.isNotEmpty) ...[
                const SizedBox(height: Spacing.sm),
                Text(
                  release.releaseNotes,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 5,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: Spacing.sm),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FilledButton.icon(
              onPressed: updateCubit.downloadUpdate,
              icon: const Icon(Icons.download, size: 18),
              label: const Text('업데이트'),
            ),
            const SizedBox(width: Spacing.sm),
            TextButton(
              onPressed: () => _openReleasePage(release.htmlUrl),
              child: const Text('릴리즈 페이지'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDownloadProgress(ThemeData theme, UpdateState updateState) {
    return Column(
      children: [
        Text(
          '다운로드 중... ${updateState.downloadProgress}%',
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: Spacing.xs),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Spacing.lg),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.full),
            child: LinearProgressIndicator(
              value: updateState.downloadProgress / 100,
              minHeight: 6,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInstallButton(
    BuildContext context,
    ThemeData theme,
    UpdateState updateState,
    UpdateCubit updateCubit,
  ) {
    return Column(
      children: [
        FilledButton.icon(
          onPressed: () =>
              _installApk(context, updateState.downloadedFilePath!),
          icon: const Icon(Icons.install_mobile, size: 18),
          label: const Text('설치'),
        ),
        const SizedBox(height: Spacing.xs),
        Text(
          '다운로드 완료',
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.tertiary,
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
