import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import {
  Text,
  List,
  Surface,
  useTheme,
  TouchableRipple,
  Icon,
  Divider,
} from "react-native-paper";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";
import { useSettingsStore } from "../store/settings";
import { useProvidersStore } from "../store/providers";
import { useApiClient } from "../hooks/use-api-client";
import { SPACING, SHADOWS, BORDER_RADIUS } from "../constants/theme";
import type { ProviderInfo } from "../types/protocol";
import type { SettingsStackParamList } from "./ProviderEditScreen";
import { ProviderSheet } from "../components/ProviderSheet";
import { ModelSection } from "../components/model-section";
import { ConnectionSection } from "../components/connection-section";

type Props = NativeStackScreenProps<SettingsStackParamList, "SettingsMain">;

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const getApi = useApiClient();
  const setSessions = useSessionsStore((s) => s.setSessions);
  const currentModel = useSettingsStore((s) => s.currentModel);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const setCurrentModel = useSettingsStore((s) => s.setCurrentModel);
  const setAvailableModels = useSettingsStore((s) => s.setAvailableModels);
  const providers = useProvidersStore((s) => s.providers);
  const activeProviderId = useProvidersStore((s) => s.activeProviderId);
  const setProviders = useProvidersStore((s) => s.setProviders);

  const [providerSheetVisible, setProviderSheetVisible] = useState(false);

  const refreshData = useCallback(async () => {
    const client = await getApi();
    if (!client) return;
    try {
      const { api, token } = client;
      const [sessions, modelInfo, providerInfo] = await Promise.all([
        api.listSessions(token),
        api.listModels(token),
        api.listProviders(token),
      ]);
      setSessions(sessions);
      setAvailableModels(modelInfo.models);
      setCurrentModel(modelInfo.current);
      setProviders(providerInfo.providers, providerInfo.activeProviderId);
    } catch {
      Alert.alert("오류", "데이터를 불러오지 못했습니다.");
      return;
    }
  }, [getApi, setSessions, setAvailableModels, setCurrentModel, setProviders]);

  useFocusEffect(
    useCallback(() => {
      if (storedAuth) refreshData();
    }, [storedAuth, refreshData]),
  );

  const handleModelChange = useCallback(
    async (model: string): Promise<void> => {
      const client = await getApi();
      if (!client) return;
      try {
        await client.api.switchModel(client.token, model);
        setCurrentModel(model);
      } catch {
        Alert.alert("오류", "모델 변경에 실패했습니다.");
      }
    },
    [getApi, setCurrentModel],
  );

  const handleDeleteProvider = useCallback(
    async (p: ProviderInfo): Promise<void> => {
      const client = await getApi();
      if (!client) return;
      try {
        await client.api.deleteProvider(client.token, p.id);
        refreshData();
      } catch {
        Alert.alert("오류", "Provider 삭제에 실패했습니다.");
      }
    },
    [getApi, refreshData],
  );

  const handleEditProvider = useCallback(
    (p: ProviderInfo): void => {
      navigation.navigate("ProviderEdit", {
        editProvider: {
          id: p.id,
          name: p.name,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
          model: p.model,
        },
      });
    },
    [navigation],
  );

  const handleAddProvider = useCallback((): void => {
    navigation.navigate("ProviderEdit", {});
  }, [navigation]);

  const activeProvider = providers.find((p) => p.id === activeProviderId);

  const themed = useMemo(
    () => ({
      sectionLabel: { color: theme.colors.onSurfaceVariant },
      providerName: {
        color: theme.colors.onSurface,
        fontWeight: "600" as const,
      },
      providerModel: { color: theme.colors.onSurfaceVariant },
      addProviderTitle: {
        color: theme.colors.primary,
        fontWeight: "500" as const,
      },
    }),
    [theme.colors],
  );

  return (
    <>
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: SPACING.md,
          paddingBottom: SPACING.xxl,
        }}
      >
        <Text
          variant="titleSmall"
          style={[styles.sectionLabel, themed.sectionLabel]}
        >
          연결
        </Text>
        <ConnectionSection onServerChanged={refreshData} />

        <Text
          variant="titleSmall"
          style={[styles.sectionLabel, themed.sectionLabel]}
        >
          AI Provider
        </Text>
        <Surface style={[styles.card, { ...SHADOWS.sm }]} elevation={0}>
          {activeProvider ? (
            <TouchableRipple onPress={() => setProviderSheetVisible(true)}>
              <View style={styles.providerCard}>
                <View
                  style={[
                    styles.providerIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="cloud-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.providerInfo}>
                  <Text variant="bodyLarge" style={themed.providerName}>
                    {activeProvider.name}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={themed.providerModel}
                    numberOfLines={1}
                  >
                    {activeProvider.model}
                  </Text>
                </View>
                <Icon
                  source="chevron-down"
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </TouchableRipple>
          ) : (
            <List.Item
              title="Provider를 설정하세요"
              description="AI 서비스를 연결하려면 탭하세요"
              left={(props) => (
                <List.Icon {...props} icon="cloud-off-outline" />
              )}
              onPress={handleAddProvider}
            />
          )}
          <Divider />
          <List.Item
            title="새 Provider 추가"
            titleStyle={themed.addProviderTitle}
            left={(props) => (
              <List.Icon {...props} icon="plus" color={theme.colors.primary} />
            )}
            onPress={handleAddProvider}
          />
        </Surface>

        {storedAuth && availableModels.length > 0 && (
          <>
            <Text
              variant="titleSmall"
              style={[styles.sectionLabel, themed.sectionLabel]}
            >
              모델
            </Text>
            <ModelSection
              currentModel={currentModel}
              availableModels={availableModels}
              onModelChange={handleModelChange}
            />
          </>
        )}

        {storedAuth && (
          <>
            <Text
              variant="titleSmall"
              style={[styles.sectionLabel, themed.sectionLabel]}
            >
              정보
            </Text>
            <Surface style={[styles.card, { ...SHADOWS.sm }]} elevation={0}>
              <List.Item
                title="버전"
                description="1.0.0"
                left={(props) => (
                  <List.Icon {...props} icon="information-outline" />
                )}
              />
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
  sectionLabel: {
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
    marginLeft: SPACING.xs,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: "hidden",
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  providerInfo: { flex: 1, marginLeft: SPACING.sm },
});
