import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import {
  Text,
  Chip,
  IconButton,
  TouchableRipple,
  Icon,
  useTheme,
} from "react-native-paper";
import { SPACING } from "../constants/theme";
import type { ProviderInfo } from "../types/protocol";

interface ProviderListItemProps {
  item: ProviderInfo;
  isActive: boolean;
  isSwitching: boolean;
  onSelect: (id: string) => Promise<boolean>;
  onEdit: (p: ProviderInfo) => void;
  onDelete: (p: ProviderInfo) => void;
}

export const ProviderListItem = React.memo(function ProviderListItem({
  item,
  isActive,
  isSwitching,
  onSelect,
  onEdit,
  onDelete,
}: ProviderListItemProps) {
  const theme = useTheme();

  return (
    <TouchableRipple
      onPress={() => onSelect(item.id)}
      style={
        isActive
          ? { backgroundColor: theme.colors.primaryContainer }
          : undefined
      }
    >
      <View style={styles.sheetItem}>
        <View
          style={[
            styles.sheetItemIcon,
            {
              backgroundColor: isActive
                ? theme.colors.primary
                : theme.colors.surfaceVariant,
            },
          ]}
        >
          <Icon
            source="cloud-outline"
            size={18}
            color={
              isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
            }
          />
        </View>
        <View style={styles.sheetItemInfo}>
          <Text
            variant="bodyLarge"
            style={isActive ? styles.sheetItemNameActive : styles.sheetItemName}
          >
            {item.name}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
            numberOfLines={1}
          >
            {item.model}
          </Text>
        </View>
        {isSwitching && (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.switchLoader}
          />
        )}
        {isActive && !isSwitching && (
          <Chip compact selected textStyle={styles.activeChipText}>
            활성
          </Chip>
        )}
        <IconButton
          icon="pencil-outline"
          size={16}
          onPress={() => onEdit(item)}
          accessibilityLabel={`${item.name} 편집`}
        />
        <IconButton
          icon="delete-outline"
          size={16}
          iconColor={theme.colors.error}
          onPress={() => onDelete(item)}
          accessibilityLabel={`${item.name} 삭제`}
        />
      </View>
    </TouchableRipple>
  );
});

const styles = StyleSheet.create({
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sheetItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetItemInfo: { flex: 1, marginLeft: SPACING.sm },
  sheetItemNameActive: { fontWeight: "600" },
  sheetItemName: { fontWeight: "400" },
  activeChipText: { fontSize: 10 },
  switchLoader: { marginRight: SPACING.xs },
});
