import React, { useMemo } from "react";
import { View, StyleSheet, Alert } from "react-native";
import {
  Text,
  List,
  Surface,
  useTheme,
  TouchableRipple,
  Icon,
} from "react-native-paper";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";
import { useSettingsStore } from "../store/settings";
import { useProvidersStore } from "../store/providers";
import { useApiClient } from "../hooks/use-api-client";
import { clearAuth } from "../services/auth";
import { SPACING, SHADOWS, BORDER_RADIUS } from "../constants/theme";

interface ConnectionSectionProps {
  onServerChanged: () => void;
}

export function ConnectionSection({ onServerChanged }: ConnectionSectionProps) {
  const theme = useTheme();
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const clearAll = useAuthStore((s) => s.clearAll);
  const isConnected = useAuthStore((s) => s.isConnected);
  const getApi = useApiClient();
  const setSessions = useSessionsStore((s) => s.setSessions);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const setAvailableModels = useSettingsStore((s) => s.setAvailableModels);
  const setCurrentModel = useSettingsStore((s) => s.setCurrentModel);
  const setProviders = useProvidersStore((s) => s.setProviders);

  const handleChangeServer = React.useCallback((): void => {
    if (!storedAuth) return;
    Alert.alert("서버 변경", "연결된 서버를 변경하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "변경",
        style: "destructive",
        onPress: async () => {
          const client = await getApi();
          if (client) {
            try {
              await client.api.unpair(client.token);
            } catch {
              /* non-critical */
            }
          }
          await clearAuth();
          clearAll();
          setSessions([]);
          setActiveSessionId(null);
          setAvailableModels([]);
          setCurrentModel("");
          setProviders([], "");
          onServerChanged();
        },
      },
    ]);
  }, [
    storedAuth,
    getApi,
    clearAll,
    setSessions,
    setActiveSessionId,
    setAvailableModels,
    setCurrentModel,
    setProviders,
    onServerChanged,
  ]);

  const statusColor = isConnected ? theme.colors.tertiary : theme.colors.error;
  const statusText = isConnected ? "연결됨" : "연결 끊김";

  const themed = useMemo(
    () => ({
      statusDot: { backgroundColor: statusColor },
      statusText: { color: statusColor },
      changeText: {
        color: theme.colors.onSurfaceVariant,
      },
    }),
    [theme.colors, statusColor],
  );

  return (
    <Surface style={[styles.card, SHADOWS.sm]} elevation={0}>
      <TouchableRipple style={styles.cardInner}>
        <View style={styles.connectionRow}>
          <View style={styles.serverInfo}>
            <View style={styles.serverTop}>
              <View style={[styles.statusDot, themed.statusDot]} />
              <Text variant="labelMedium" style={themed.statusText}>
                {statusText}
              </Text>
            </View>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface }}
              numberOfLines={1}
            >
              {storedAuth?.serverUrl ?? "-"}
            </Text>
          </View>
          <TouchableRipple
            onPress={handleChangeServer}
            style={styles.changeButton}
            borderless
          >
            <View style={styles.changeContent}>
              <Text
                variant="labelMedium"
                style={themed.changeText}
              >
                변경
              </Text>
              <Icon
                source="chevron-right"
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </TouchableRipple>
        </View>
      </TouchableRipple>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  cardInner: {
    borderRadius: BORDER_RADIUS.lg,
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  serverInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  serverTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  changeButton: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  changeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
});
