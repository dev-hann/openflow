import React from "react";
import { View, StyleSheet } from "react-native";
import {
  Text,
  Menu,
  TouchableRipple,
  Icon,
  useTheme,
} from "react-native-paper";
import { PROVIDER_PRESETS } from "../constants/presets";
import type { ProviderPreset } from "../constants/presets";
import { SPACING, BORDER_RADIUS } from "../constants/theme";

interface PresetSelectorProps {
  selectedPreset: ProviderPreset | null;
  visible: boolean;
  onDismiss: () => void;
  onShow: () => void;
  onSelect: (preset: ProviderPreset) => void;
}

export function PresetSelector({
  selectedPreset,
  visible,
  onDismiss,
  onShow,
  onSelect,
}: PresetSelectorProps) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text
        variant="labelMedium"
        style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
      >
        Provider 유형
      </Text>
      <Menu
        visible={visible}
        onDismiss={onDismiss}
        anchor={
          <TouchableRipple
            onPress={onShow}
            style={[
              styles.anchor,
              {
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surfaceVariant,
              },
            ]}
          >
            <View style={styles.anchorContent}>
              <View style={styles.anchorTextWrap}>
                {selectedPreset ? (
                  <>
                    <Text
                      variant="bodyMedium"
                      style={{ fontWeight: "500" }}
                    >
                      {selectedPreset.label}
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {selectedPreset.hint}
                    </Text>
                  </>
                ) : (
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    선택하세요
                  </Text>
                )}
              </View>
              <Icon
                source="chevron-down"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </TouchableRipple>
        }
        contentStyle={[
          styles.menuContent,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        {PROVIDER_PRESETS.map((preset) => (
          <Menu.Item
            key={preset.id}
            onPress={() => onSelect(preset)}
            title={`${preset.label}  ·  ${preset.hint}`}
            leadingIcon={
              preset.id === selectedPreset?.id
                ? "check-circle"
                : "circle-outline"
            }
            titleStyle={{
              fontWeight: preset.id === selectedPreset?.id ? "600" : "400",
            }}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: SPACING.sm },
  label: { marginBottom: SPACING.xs },
  anchor: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  anchorContent: { flexDirection: "row", alignItems: "center" },
  anchorTextWrap: { flex: 1 },
  menuContent: { maxHeight: 400 },
});
