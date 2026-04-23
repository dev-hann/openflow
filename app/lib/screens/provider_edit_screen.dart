import 'package:flutter/widgets.dart';

import 'package:openflow/models/protocol.dart';
import 'package:openflow/widgets/app_scaffold.dart';
import 'package:openflow/widgets/provider_form.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class ProviderEditScreen extends StatelessWidget {
  const ProviderEditScreen({super.key, this.provider});
  final ProviderInfo? provider;

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: provider != null ? 'Provider 편집' : 'Provider 추가',
      leading: ShadIconButton.ghost(
        icon: Icon(
          LucideIcons.arrowLeft,
          color: ShadTheme.of(context).colorScheme.foreground,
        ),
        onPressed: () => Navigator.of(context).pop(),
      ),
      body: ProviderForm(
        editProvider: provider,
        onComplete: () => Navigator.of(context).pop(),
      ),
    );
  }
}
