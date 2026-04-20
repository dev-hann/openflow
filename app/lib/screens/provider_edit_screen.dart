import 'package:flutter/material.dart';
import '../models/protocol.dart';
import '../widgets/provider_form.dart';

class ProviderEditScreen extends StatelessWidget {
  final ProviderInfo? provider;

  const ProviderEditScreen({super.key, this.provider});

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
