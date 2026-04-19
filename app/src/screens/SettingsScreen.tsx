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
  const [modelSheetVisible, setModelSheetVisible] = useState(false);

  const closeProviderSheet = useCallback(
    () => setProviderSheetVisible(false),
    [],
  );

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

  const activeProvider = useMemo(
    () => providers.find((p) => p.id === activeProviderId),
    [providers, activeProviderId],
  );

  const themed = useMemo(
    () => ({
      sectionLabel: { color: theme.colors.onSurfaceVariant },
      providerName: {
        color: theme.colors.onSurface,
        fontWeight: "600" as const,
      },
      providerModel: { color: theme.colors.onSurfaceVariant },
      changeText: {
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
        contentContainerStyle={styles.scrollContent}
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
          AI 모델
        </Text>
        <Surface style={[styles.card, SHADOWS.sm]} elevation={0}>
          {activeProvider ? (
            <TouchableRipple
              onPress={() => setModelSheetVisible(true)}
              style={styles.aiModelCard}
            >
              <View style={styles.aiModelRow}>
                <View
                  style={[
                    styles.providerIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="brain"
                    size={22}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.aiModelInfo}>
                  <Text variant="bodyLarge" style={themed.providerName}>
                    {currentModel || activeProvider.model || "모델 없음"}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={themed.providerModel}
                    numberOfLines={1}
                  >
                    via {activeProvider.name}
                  </Text>
                </View>
                <Text
                  variant="labelMedium"
                  style={themed.changeText}
                >
                  변경
                </Text>
                <Icon
                  source="chevron-right"
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
        </Surface>

        <Text
          variant="titleSmall"
          style={[styles.sectionLabel, themed.sectionLabel]}
        >
          관리
        </Text>
        <Surface style={[styles.card, SHADOWS.sm]} elevation={0}>
          <List.Item
            title="Provider 관리"
            description={`${providers.length}개 Provider`}
            left={(props) => (
              <List.Icon {...props} icon="cloud-outline" />
            )}
            right={(props) => (
              <List.Icon {...props} icon="chevron-right" />
            )}
            onPress={() => setProviderSheetVisible(true)}
          />
          {storedAuth && availableModels.length > 0 && (
            <>
              <Divider />
              <List.Item
                title="모델 선택"
                description={currentModel || "선택 안됨"}
                left={(props) => (
                  <List.Icon {...props} icon="cube-outline" />
                )}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" />
                )}
                onPress={() => setModelSheetVisible(true)}
              />
            </>
          )}
          <Divider />
          <List.Item
            title="새 Provider 추가"
            titleStyle={themed.changeText}
            left={(props) => (
              <List.Icon {...props} icon="plus" color={theme.colors.primary} />
            )}
            onPress={handleAddProvider}
          />
        </Surface>

        {storedAuth && (
          <>
            <Text
              variant="titleSmall"
              style={[styles.sectionLabel, themed.sectionLabel]}
            >
              정보
            </Text>
            <Surface style={[styles.card, SHADOWS.sm]} elevation={0}>
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
        onClose={closeProviderSheet}
        onEdit={handleEditProvider}
        onDelete={handleDeleteProvider}
        onAdd={handleAddProvider}
      />

      {storedAuth && availableModels.length > 0 && (
        <ModelSection
          visible={modelSheetVisible}
          onClose={() => setModelSheetVisible(false)}
          currentModel={currentModel}
          availableModels={availableModels}
          onModelChange={async (model) => {
            await handleModelChange(model);
            setModelSheetVisible(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
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
  aiModelCard: {
    borderRadius: BORDER_RADIUS.lg,
  },
  aiModelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  aiModelInfo: {
    flex: 1,
    marginLeft: SPACING.xs,
  },
});
