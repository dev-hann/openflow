import 'package:flutter/material.dart';
import 'package:openflow/constants/dimensions.dart';
import 'package:openflow/models/protocol.dart';

class ProviderSheet extends StatelessWidget {

  const ProviderSheet({
    required this.providers, required this.onSelect, required this.onEdit, required this.onDelete, required this.onAdd, super.key,
    this.activeProviderId,
    this.isSwitching = false,
  });
  final List<ProviderInfo> providers;
  final String? activeProviderId;
  final bool isSwitching;
  final ValueChanged<String> onSelect;
  final ValueChanged<ProviderInfo> onEdit;
  final ValueChanged<String> onDelete;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(Spacing.md),
            child: Row(
              children: [
                Text('Provider 관리',
                    style: Theme.of(context).textTheme.titleMedium,),
                const Spacer(),
                TextButton.icon(
                  onPressed: onAdd,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('추가'),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: providers.length,
              itemBuilder: (context, index) {
                final provider = providers[index];
                final isActive = provider.id == activeProviderId;
                return ListTile(
                  leading: Icon(
                    Icons.dns_outlined,
                    color: isActive
                        ? Theme.of(context).colorScheme.primary
                        : null,
                  ),
                  title: Text(provider.name),
                  subtitle: Text(
                    provider.model.isNotEmpty ? provider.model : provider.baseUrl,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: isActive
                      ? const Chip(
                          label: Text('활성'),
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                        )
                      : isSwitching
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.edit_outlined, size: 18),
                                  onPressed: () => onEdit(provider),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, size: 18),
                                  onPressed: () => onDelete(provider.id),
                                ),
                              ],
                            ),
                  onTap: isActive ? null : () => onSelect(provider.id),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
