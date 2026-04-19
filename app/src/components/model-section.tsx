import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import {
  Text,
  List,
  Surface,
  useTheme,
  TouchableRipple,
  Icon,
  Menu,
} from "react-native-paper";
import { SPACING, SHADOWS, BORDER_RADIUS } from "../constants/theme";

interface ModelSectionProps {
  currentModel: string;
  availableModels: string[];
  onModelChange: (model: string) => Promise<void>;
}

export function ModelSection({
  currentModel,
  availableModels,
  onModelChange,
}: ModelSectionProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleSelect = useCallback(
    async (model: string) => {
      await onModelChange(model);
      setMenuVisible(false);
    },
    [onModelChange],
  );

  const themed = useMemo(
    () => ({
      label: { color: theme.colors.onSurfaceVariant },
      value: {
        color: theme.colors.onSurface,
        fontWeight: "500" as const,
      },
    }),
    [theme.colors],
  );

  return (
    <Surface style={[styles.card, { ...SHADOWS.sm }]} elevation={0}>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <TouchableRipple onPress={() => setMenuVisible(true)}>
            <View style={styles.modelRow}>
              <List.Icon icon="cube-outline" />
              <View style={styles.modelInfo}>
                <Text variant="bodySmall" style={themed.label}>
                  현재 모델
                </Text>
                <Text variant="bodyLarge" style={themed.value}>
                  {currentModel ?? "선택 안됨"}
                </Text>
              </View>
              <Icon
                source="chevron-down"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </TouchableRipple>
        }
        contentStyle={{
          backgroundColor: theme.colors.surface,
          borderRadius: BORDER_RADIUS.md,
        }}
      >
        {availableModels.map((m) => (
          <Menu.Item
            key={m}
            onPress={() => handleSelect(m)}
            title={m}
            leadingIcon={
              m === currentModel ? "check-circle" : "circle-outline"
            }
            titleStyle={{
              fontWeight: m === currentModel ? "600" : "400",
            }}
          />
        ))}
      </Menu>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: SPACING.md,
  },
  modelInfo: { flex: 1 },
});
