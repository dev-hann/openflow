import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, Modal, Pressable, FlatList } from "react-native";
import {
  Text,
  useTheme,
  TouchableRipple,
  Icon,
} from "react-native-paper";
import { SPACING, BORDER_RADIUS, SHADOWS } from "../constants/theme";

interface ModelSectionProps {
  visible: boolean;
  onClose: () => void;
  currentModel: string;
  availableModels: string[];
  onModelChange: (model: string) => Promise<void>;
}

const SHEET_HEIGHT_RATIO = 0.5;
const BACKDROP_COLOR = "rgba(0,0,0,0.4)";

export function ModelSection({
  visible,
  onClose,
  currentModel,
  availableModels,
  onModelChange,
}: ModelSectionProps) {
  const theme = useTheme();

  const handleSelect = useCallback(
    async (model: string) => {
      await onModelChange(model);
    },
    [onModelChange],
  );

  const themed = useMemo(
    () => ({
      modalBg: { backgroundColor: theme.colors.surface },
      handle: { backgroundColor: theme.colors.outline },
      title: { color: theme.colors.onSurface },
      modelName: { color: theme.colors.onSurface },
      modelDesc: { color: theme.colors.onSurfaceVariant },
      activeBg: { backgroundColor: theme.colors.primaryContainer },
      activeText: { color: theme.colors.primary },
    }),
    [theme.colors],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const isActive = item === currentModel;
      return (
        <TouchableRipple onPress={() => handleSelect(item)}>
          <View
            style={[
              styles.modelItem,
              isActive && styles.modelItemActive,
              isActive && themed.activeBg,
            ]}
          >
            <View style={styles.modelItemContent}>
              <Icon
                source={isActive ? "check-circle" : "circle-outline"}
                size={20}
                color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <View style={styles.modelItemText}>
                <Text
                  variant="bodyLarge"
                  style={[
                    themed.modelName,
                    isActive && themed.activeText,
                    isActive && { fontWeight: "600" },
                  ]}
                  numberOfLines={1}
                >
                  {item}
                </Text>
              </View>
            </View>
          </View>
        </TouchableRipple>
      );
    },
    [currentModel, handleSelect, theme.colors, themed],
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
            themed.modalBg,
          ]}
        >
          <View style={[styles.sheetHandle, themed.handle]} />
          <View style={styles.sheetHeader}>
            <Text variant="titleMedium" style={[styles.sheetTitle, themed.title]}>
              모델 선택
            </Text>
          </View>
          <FlatList
            data={availableModels}
            keyExtractor={(item) => item}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
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
    maxHeight: "50%",
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sheetTitle: {
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: SPACING.xl,
  },
  modelItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
  },
  modelItemActive: {
    borderRadius: BORDER_RADIUS.md,
  },
  modelItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  modelItemText: {
    flex: 1,
  },
});
