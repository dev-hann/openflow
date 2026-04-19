import React from "react";
import {
  View,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  useWindowDimensions,
  Pressable,
} from "react-native";
import {
  Text,
  Button,
  useTheme,
  Icon,
} from "react-native-paper";
import { useApiClient } from "../hooks/use-api-client";
import { useProvidersStore } from "../store/providers";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import type { ProviderInfo } from "../types/protocol";
import { ItemSeparator } from "./item-separator";
import { ProviderListItem } from "./provider-list-item";

const SHEET_HEIGHT_RATIO = 0.65;
const BACKDROP_COLOR = "rgba(0,0,0,0.4)";

interface ProviderSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: (p: ProviderInfo) => void;
  onDelete: (p: ProviderInfo) => void;
  onAdd: () => void;
}

export function ProviderSheet({
  visible,
  onClose,
  onEdit,
  onDelete,
  onAdd,
}: ProviderSheetProps) {
  const theme = useTheme();
  const sheetHeight = useWindowDimensions().height * SHEET_HEIGHT_RATIO;
  const providers = useProvidersStore((s) => s.providers);
  const activeProviderId = useProvidersStore((s) => s.activeProviderId);
  const setActiveProviderId = useProvidersStore((s) => s.setActiveProviderId);
  const getApi = useApiClient();
  const switchingIdRef = React.useRef<string | null>(null);
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  const handleSwitch = React.useCallback(
    async (id: string): Promise<boolean> => {
      if (switchingIdRef.current) return false;
      switchingIdRef.current = id;
      setSwitchingId(id);
      const client = await getApi();
      if (!client) {
        switchingIdRef.current = null;
        setSwitchingId(null);
        return false;
      }
      try {
        await client.api.switchProvider(client.token, id);
        setActiveProviderId(id);
        return true;
      } catch {
        Alert.alert("오류", "Provider 전환에 실패했습니다.");
        return false;
      } finally {
        switchingIdRef.current = null;
        setSwitchingId(null);
      }
    },
    [getApi, setActiveProviderId],
  );

  const handleDelete = React.useCallback(
    (p: ProviderInfo): void => {
      Alert.alert("삭제", `"${p.name}" 삭제하시겠습니까?`, [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: () => onDelete(p) },
      ]);
    },
    [onDelete],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View
          style={[
            styles.sheetContainer,
            { maxHeight: sheetHeight, backgroundColor: theme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.sheetHandle,
              { backgroundColor: theme.colors.outline },
            ]}
          />
          <View style={styles.sheetHeader}>
            <Text variant="titleMedium" style={styles.sheetTitle}>
              Provider 선택
            </Text>
            <Button mode="text" onPress={onAdd} icon="plus" compact>
              추가
            </Button>
          </View>
          <FlatList
            data={providers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ProviderListItem
                item={item}
                isActive={item.id === activeProviderId}
                isSwitching={switchingId === item.id}
                onSelect={handleSwitch}
                onEdit={(p) => {
                  onEdit(p);
                  onClose();
                }}
                onDelete={handleDelete}
              />
            )}
            ItemSeparatorComponent={ItemSeparator}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon
                  source="cloud-off-outline"
                  size={40}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.emptyText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Provider가 없습니다
                </Text>
                <Button
                  mode="outlined"
                  onPress={() => {
                    onAdd();
                    onClose();
                  }}
                  icon="plus"
                  style={styles.emptyAddButton}
                >
                  추가하기
                </Button>
              </View>
            }
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: BACKDROP_COLOR,
  },
  sheetContainer: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    paddingBottom: SPACING.xl,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sheetTitle: { fontWeight: "600" },
  listContent: { paddingBottom: SPACING.xl },
  emptyContainer: { paddingVertical: SPACING.xxl, alignItems: "center" },
  emptyText: { marginTop: SPACING.md },
  emptyAddButton: { marginTop: SPACING.md },
});
