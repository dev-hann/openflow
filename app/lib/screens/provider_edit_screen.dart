import 'package:flutter/material.dart';

import 'package:openflow/models/protocol.dart';
import 'package:openflow/widgets/provider_form.dart';

class ProviderEditScreen extends StatelessWidget {
  const ProviderEditScreen({super.key, this.provider});
  final ProviderInfo? provider;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(provider != null ? 'Provider 편집' : 'Provider 추가'),
      ),
      body: ProviderForm(
        editProvider: provider,
        onComplete: () => Navigator.of(context).pop(),
      ),
    );
  }
}
