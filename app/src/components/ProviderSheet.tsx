import React from "react";
import { View, StyleSheet, Alert, Modal, FlatList, useWindowDimensions } from "react-native";
import { Text, Button, useTheme, Divider, Chip, IconButton, TouchableRipple, Icon } from "react-native-paper";
import { useApiClient } from "../hooks/use-api-client";
import { useProvidersStore } from "../store/providers";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import type { ProviderInfo } from "../types/protocol";

function ItemSeparator(): React.ReactElement {
  return <Divider />;
}

interface ProviderSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: (p: ProviderInfo) => void;
  onDelete: (p: ProviderInfo) => void;
  onAdd: () => void;
}

export function ProviderSheet({ visible, onClose, onEdit, onDelete, onAdd }: ProviderSheetProps) {
  const theme = useTheme();
  const sheetHeight = useWindowDimensions().height * 0.65;
  const providers = useProvidersStore((s) => s.providers);
  const activeProviderId = useProvidersStore((s) => s.activeProviderId);
  const setActiveProviderId = useProvidersStore((s) => s.setActiveProviderId);
  const getApi = useApiClient();

  async function handleSwitch(id: string): Promise<void> {
    const client = await getApi();
    if (!client) return;
    try {
      await client.api.switchProvider(client.token, id);
      setActiveProviderId(id);
    } catch {
      Alert.alert("오류", "Provider 전환에 실패했습니다.");
    }
  }

  function handleDelete(p: ProviderInfo): void {
    Alert.alert("삭제", `"${p.name}" 삭제하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => onDelete(p) },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={[styles.sheetContainer, { maxHeight: sheetHeight, backgroundColor: theme.colors.surface }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.colors.outline }]} />
          <View style={styles.sheetHeader}>
            <Text variant="titleMedium" style={styles.sheetTitle}>Provider 선택</Text>
            <Button mode="text" onPress={onAdd} icon="plus" compact>추가</Button>
          </View>
          <FlatList
            data={providers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isActive = item.id === activeProviderId;
              return (
                <TouchableRipple
                  onPress={() => { handleSwitch(item.id); onClose(); }}
                  style={isActive ? { backgroundColor: theme.colors.primaryContainer } : undefined}
                >
                  <View style={styles.sheetItem}>
                    <View style={[styles.sheetItemIcon, { backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceVariant }]}>
                      <Icon source="cloud-outline" size={18} color={isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />
                    </View>
                    <View style={styles.sheetItemInfo}>
                      <Text variant="bodyLarge" style={isActive ? styles.sheetItemNameActive : styles.sheetItemName}>
                        {item.name}
                      </Text>
                      <Text variant="bodySmall" style={[styles.sheetItemModel, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                        {item.model}
                      </Text>
                    </View>
                    {isActive && <Chip compact selected textStyle={styles.activeChipText}>활성</Chip>}
                    <IconButton icon="pencil-outline" size={16} onPress={() => { onEdit(item); onClose(); }} accessibilityLabel={`${item.name} 편집`} />
                    <IconButton icon="delete-outline" size={16} iconColor={theme.colors.error} onPress={() => handleDelete(item)} accessibilityLabel={`${item.name} 삭제`} />
                  </View>
                </TouchableRipple>
              );
            }}
            ItemSeparatorComponent={ItemSeparator}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheetContainer: { borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: SPACING.sm, marginBottom: SPACING.xs },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  sheetItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  sheetItemIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  sheetTitle: { fontWeight: "600" },
  sheetItemInfo: { flex: 1, marginLeft: SPACING.sm },
  sheetItemNameActive: { fontWeight: "600" },
  sheetItemName: { fontWeight: "400" },
  sheetItemModel: {},
  activeChipText: { fontSize: 10 },
  listContent: { paddingBottom: SPACING.xl },
});
