import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Text, List, Button, Surface, useTheme, TouchableRipple, Icon, Menu, Divider } from "react-native-paper";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";
import { useSettingsStore } from "../store/settings";
import { useProvidersStore } from "../store/providers";
import { createApiClient } from "../services/api";
import { clearAuth } from "../services/auth";
import { SPACING, SHADOWS, BORDER_RADIUS } from "../constants/theme";
import type { ProviderInfo } from "../types/protocol";
import type { SettingsStackParamList } from "./ProviderEditScreen";
import { ProviderSheet } from "../components/ProviderSheet";

type Props = NativeStackScreenProps<SettingsStackParamList, "SettingsMain">;

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const clearAll = useAuthStore((s) => s.clearAll);
  const isConnected = useAuthStore((s) => s.isConnected);
  const getValidToken = useAuthStore((s) => s.getValidToken);
  const setSessions = useSessionsStore((s) => s.setSessions);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const currentModel = useSettingsStore((s) => s.currentModel);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const setCurrentModel = useSettingsStore((s) => s.setCurrentModel);
  const setAvailableModels = useSettingsStore((s) => s.setAvailableModels);
  const providers = useProvidersStore((s) => s.providers);
  const activeProviderId = useProvidersStore((s) => s.activeProviderId);
  const setProviders = useProvidersStore((s) => s.setProviders);
  const setActiveProviderId = useProvidersStore((s) => s.setActiveProviderId);

  const [providerSheetVisible, setProviderSheetVisible] = useState(false);
  const [modelMenuVisible, setModelMenuVisible] = useState(false);

  const refreshData = useCallback(async () => {
    const token = await getValidToken();
    const auth = useAuthStore.getState().storedAuth;
    if (!token || !auth) return;
    try {
      const api = createApiClient(auth.serverUrl);
      const [sessions, modelInfo, providerInfo] = await Promise.all([
        api.listSessions(token), api.listModels(token), api.listProviders(token),
      ]);
      setSessions(sessions);
      setAvailableModels(modelInfo.models);
      setCurrentModel(modelInfo.current);
      setProviders(providerInfo.providers, providerInfo.activeProviderId);
    } catch {
      return;
    }
  }, [getValidToken, setSessions, setAvailableModels, setCurrentModel, setProviders]);

  useEffect(() => { if (storedAuth) refreshData(); }, [storedAuth, refreshData]);

  function handleChangeServer(): void {
    if (!storedAuth) return;
    Alert.alert("서버 변경", "연결된 서버를 변경하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "변경", style: "destructive", onPress: async () => {
        const token = await getValidToken();
        if (token) { try { await createApiClient(storedAuth.serverUrl).unpair(token); } catch { return; } }
        await clearAuth();
        clearAll();
        setSessions([]);
        setActiveSessionId(null);
      }},
    ]);
  }

  async function handleModelChange(model: string): Promise<void> {
    const token = await getValidToken();
    if (!token || !storedAuth) return;
    try {
      await createApiClient(storedAuth.serverUrl).switchModel(token, model);
      setCurrentModel(model);
      setModelMenuVisible(false);
    } catch { Alert.alert("오류", "모델 변경에 실패했습니다."); }
  }

  async function handleDeleteProvider(p: ProviderInfo): Promise<void> {
    const token = await getValidToken();
    if (!token || !storedAuth) return;
    try { await createApiClient(storedAuth.serverUrl).deleteProvider(token, p.id); refreshData(); }
    catch { Alert.alert("오류", "Provider 삭제에 실패했습니다."); }
  }

  function handleEditProvider(p: ProviderInfo): void {
    navigation.navigate("ProviderEdit", {
      editProvider: { id: p.id, name: p.name, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model },
    });
  }

  function handleAddProvider(): void {
    navigation.navigate("ProviderEdit", {});
  }

  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const statusColor = isConnected ? theme.colors.tertiary : theme.colors.error;
  const statusText = isConnected ? "연결됨" : "연결 끊김";

  return (
    <>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}>
        <Text variant="titleSmall" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>연결</Text>
        <Surface style={[styles.card, { ...SHADOWS.sm }]} elevation={0}>
          <List.Item
            title="서버"
            description={storedAuth?.serverUrl ?? "-"}
            left={(props) => <List.Icon {...props} icon="server" />}
            right={() => (
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
                <Text variant="labelSmall" style={{ color: statusColor }}>{statusText}</Text>
              </View>
            )}
          />
          <Divider />
          <List.Item
            title="서버 변경"
            titleStyle={{ color: theme.colors.error }}
            left={(props) => <List.Icon {...props} icon="link-off" color={theme.colors.error} />}
            onPress={handleChangeServer}
          />
        </Surface>

        <Text variant="titleSmall" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>AI Provider</Text>
        <Surface style={[styles.card, { ...SHADOWS.sm }]} elevation={0}>
          {activeProvider ? (
            <TouchableRipple onPress={() => setProviderSheetVisible(true)}>
              <View style={styles.providerCard}>
                <View style={[styles.providerIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Icon source="cloud-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text variant="bodyLarge" style={{ fontWeight: "600" }}>{activeProvider.name}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                    {activeProvider.model}
                  </Text>
                </View>
                <Icon source="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
              </View>
            </TouchableRipple>
          ) : (
            <List.Item
              title="Provider를 설정하세요"
              description="AI 서비스를 연결하려면 탭하세요"
              left={(props) => <List.Icon {...props} icon="cloud-off-outline" />}
              onPress={handleAddProvider}
            />
          )}
          <Divider />
          <List.Item
            title="새 Provider 추가"
            titleStyle={{ color: theme.colors.primary, fontWeight: "500" }}
            left={(props) => <List.Icon {...props} icon="plus" color={theme.colors.primary} />}
            onPress={handleAddProvider}
          />
        </Surface>

        {storedAuth && availableModels.length > 0 && (
          <>
            <Text variant="titleSmall" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>모델</Text>
            <Surface style={[styles.card, { ...SHADOWS.sm }]} elevation={0}>
              <Menu
                visible={modelMenuVisible}
                onDismiss={() => setModelMenuVisible(false)}
                anchor={
                  <TouchableRipple onPress={() => setModelMenuVisible(true)}>
                    <View style={styles.modelRow}>
                      <List.Icon icon="cube-outline" />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>현재 모델</Text>
                        <Text variant="bodyLarge" style={{ fontWeight: "500" }}>{currentModel ?? "선택 안됨"}</Text>
                      </View>
                      <Icon source="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
                    </View>
                  </TouchableRipple>
                }
                contentStyle={{ backgroundColor: theme.colors.surface, borderRadius: BORDER_RADIUS.md }}
              >
                {availableModels.map((m) => (
                  <Menu.Item
                    key={m}
                    onPress={() => handleModelChange(m)}
                    title={m}
                    leadingIcon={m === currentModel ? "check-circle" : "circle-outline"}
                    titleStyle={{ fontWeight: m === currentModel ? "600" : "400" }}
                  />
                ))}
              </Menu>
            </Surface>
          </>
        )}

        {storedAuth && (
          <>
            <Text variant="titleSmall" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>정보</Text>
            <Surface style={[styles.card, { ...SHADOWS.sm }]} elevation={0}>
              <List.Item title="버전" description="1.0.0" left={(props) => <List.Icon {...props} icon="information-outline" />} />
            </Surface>
          </>
        )}
      </ScrollView>

      <ProviderSheet
        visible={providerSheetVisible}
        onClose={() => setProviderSheetVisible(false)}
        onEdit={handleEditProvider}
        onDelete={handleDeleteProvider}
        onAdd={handleAddProvider}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: SPACING.xs, marginTop: SPACING.sm, marginLeft: SPACING.xs, fontWeight: "600", letterSpacing: 0.5 },
  card: { borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md, overflow: "hidden" },
  providerCard: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, paddingHorizontal: SPACING.md },
  providerIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  modelRow: { flexDirection: "row", alignItems: "center", paddingRight: SPACING.md },
});
