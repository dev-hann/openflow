import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Text, TextInput, Button, Card, useTheme } from "react-native-paper";
import { KeyboardSafeView } from "./KeyboardSafeView";
import { PresetSelector } from "./preset-selector";
import { VerifySection } from "./verify-section";
import type { ProviderPreset } from "../constants/presets";
import type { ProviderInfo } from "../types/protocol";
import { useAuthStore } from "../store/auth";
import { createApiClient } from "../services/api";
import { normalizeUrl } from "../utils/normalize-url";
import { SPACING } from "../constants/theme";
import { useProviderVerify } from "../hooks/use-provider-verify";

interface ProviderFormProps {
  onComplete: () => void;
  showSkip?: boolean;
  editProvider?: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  } | null;
}

export function ProviderForm({
  onComplete,
  showSkip,
  editProvider,
}: ProviderFormProps) {
  const theme = useTheme();
  const getValidToken = useAuthStore((s) => s.getValidToken);
  const storedAuth = useAuthStore((s) => s.storedAuth);

  const isEditMode = !!editProvider;
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(
    null,
  );
  const [presetMenuVisible, setPresetMenuVisible] = useState(false);
  const [name, setName] = useState(editProvider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(editProvider?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(editProvider?.apiKey ?? "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState(editProvider?.model ?? "");
  const [loading, setLoading] = useState(false);

  const { verifying, verifyResult, handleVerify } = useProviderVerify(
    baseUrl,
    apiKey,
  );

  function handleSelectPreset(preset: ProviderPreset): void {
    setSelectedPreset(preset);
    if (preset.baseUrl) setBaseUrl(preset.baseUrl);
    if (!name) setName(preset.label.split(" (")[0]);
    setPresetMenuVisible(false);
  }

  async function handleVerifyAndSelect(): Promise<void> {
    const result = await handleVerify();
    if (result && result.models.length > 0 && !model) {
      setModel(result.models[0]);
    }
  }

  async function handleSave(): Promise<void> {
    const trimmedName = name.trim();
    const trimmedUrl = normalizeUrl(baseUrl);
    if (!trimmedName) {
      Alert.alert("오류", "Provider 이름을 입력하세요.");
      return;
    }
    if (!trimmedUrl) {
      Alert.alert("오류", "Base URL을 입력하세요.");
      return;
    }
    if (
      !isEditMode &&
      selectedPreset?.needsApiKey !== false &&
      !apiKey.trim()
    ) {
      Alert.alert("오류", "API Key를 입력하세요.");
      return;
    }
    setLoading(true);
    const token = await getValidToken();
    if (!token || !storedAuth) {
      setLoading(false);
      Alert.alert("오류", "인증 정보가 없습니다.");
      return;
    }
    try {
      const api = createApiClient(storedAuth.serverUrl);
      if (editProvider) {
        const params: Partial<
          Pick<ProviderInfo, "name" | "baseUrl" | "apiKey" | "model">
        > = {
          name: trimmedName,
          baseUrl: trimmedUrl,
          model: model || "default",
        };
        if (apiKey.trim()) params.apiKey = apiKey.trim();
        await api.updateProvider(token, editProvider.id, params);
      } else {
        await api.createProvider(token, {
          name: trimmedName,
          baseUrl: trimmedUrl,
          apiKey: apiKey.trim(),
          model: model || "default",
          isDefault: true,
        });
      }
      onComplete();
    } catch (err) {
      Alert.alert(
        "저장 실패",
        err instanceof Error ? err.message : "알 수 없는 오류",
      );
    } finally {
      setLoading(false);
    }
  }

  const showApiKeyField = selectedPreset?.needsApiKey !== false || isEditMode;

  return (
    <KeyboardSafeView>
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="headlineSmall" style={styles.headline}>
          {isEditMode ? editProvider.name : "새 Provider"}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          {isEditMode
            ? "연결 정보를 수정하세요"
            : "사용할 AI 서비스를 설정하세요"}
        </Text>
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          mode="contained"
        >
          <Card.Content>
            {!isEditMode && (
              <PresetSelector
                selectedPreset={selectedPreset}
                visible={presetMenuVisible}
                onDismiss={() => setPresetMenuVisible(false)}
                onShow={() => setPresetMenuVisible(true)}
                onSelect={handleSelectPreset}
              />
            )}
            <TextInput
              label="이름"
              placeholder="예: My GPT-4o"
              value={name}
              onChangeText={setName}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.field}
            />
            <TextInput
              label="Base URL"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChangeText={setBaseUrl}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.field}
            />
            {showApiKeyField && (
              <TextInput
                label="API Key"
                placeholder={
                  isEditMode ? "(변경하지 않으려면 비워두세요)" : "sk-..."
                }
                value={apiKey}
                onChangeText={setApiKey}
                mode="outlined"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showApiKey}
                style={styles.field}
                right={
                  <TextInput.Icon
                    icon={showApiKey ? "eye-off" : "eye"}
                    onPress={() => setShowApiKey((v) => !v)}
                    forceTextInputFocus={false}
                  />
                }
              />
            )}
            <VerifySection
              verifying={verifying}
              verifyResult={verifyResult}
              selectedModel={model}
              baseUrl={baseUrl}
              onVerify={handleVerifyAndSelect}
              onSelectModel={setModel}
            />
            <TextInput
              label="모델"
              placeholder="예: gpt-4o"
              value={model}
              onChangeText={setModel}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.field}
            />
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={loading}
                disabled={loading}
                style={styles.saveButton}
              >
                {isEditMode ? "수정" : "저장"}
              </Button>
            </View>
            {showSkip && (
              <Button
                mode="text"
                onPress={onComplete}
                style={styles.skipButton}
              >
                나중에 설정하기
              </Button>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  headline: { marginBottom: SPACING.xs },
  subtitle: { marginBottom: SPACING.lg },
  card: { overflow: "hidden" },
  field: { marginBottom: SPACING.sm },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    alignItems: "center",
  },
  saveButton: { flex: 1 },
  skipButton: { marginTop: SPACING.sm },
});
