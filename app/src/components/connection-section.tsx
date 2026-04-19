import React, { useMemo } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { Text, List, Surface, useTheme, Divider } from "react-native-paper";
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
      serverTitle: { color: theme.colors.error },
    }),
    [theme.colors, statusColor],
  );

  return (
    <Surface style={[styles.card, { ...SHADOWS.sm }]} elevation={0}>
      <List.Item
        title="서버"
        description={storedAuth?.serverUrl ?? "-"}
        left={(props) => <List.Icon {...props} icon="server" />}
        right={() => (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, themed.statusDot]} />
            <Text variant="labelSmall" style={themed.statusText}>
              {statusText}
            </Text>
          </View>
        )}
      />
      <Divider />
      <List.Item
        title="서버 변경"
        titleStyle={themed.serverTitle}
        left={(props) => (
          <List.Icon
            {...props}
            icon="link-off"
            color={theme.colors.error}
          />
        )}
        onPress={handleChangeServer}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
