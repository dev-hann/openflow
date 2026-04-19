import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import {
  Text,
  TextInput,
  Button,
  Card,
  useTheme,
  Surface,
  TouchableRipple,
  Icon,
} from "react-native-paper";
import { KeyboardSafeView } from "./KeyboardSafeView";
import { VerifySection } from "./verify-section";
import { PROVIDER_PRESETS } from "../constants/presets";
import type { ProviderPreset } from "../constants/presets";
import type { ProviderInfo } from "../types/protocol";
import { useAuthStore } from "../store/auth";
import { createApiClient } from "../services/api";
import { normalizeUrl } from "../utils/normalize-url";
import { SPACING, BORDER_RADIUS, SHADOWS } from "../constants/theme";
import { useProviderVerify } from "../hooks/use-provider-verify";

const GRID_COLUMNS = 3;
const GRID_GAP = SPACING.sm;

const PRESET_ICONS: Record<string, string> = {
  "zai-coding-global": "code-braces",
  "zai-coding-cn": "code-braces",
  "zai-global": "earth",
  "zai-cn": "earth",
  openai: "robot-outline",
  anthropic: "brain",
  google: "google",
  deepseek: "magnify",
  groq: "lightning-bolt",
  openrouter: "transit-connection-variant",
  ollama: "llama",
  custom: "cog-outline",
};

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
  }

  function validateForm(): string | null {
    if (!name.trim()) return "Provider 이름을 입력하세요.";
    if (!normalizeUrl(baseUrl)) return "Base URL을 입력하세요.";
    if (!isEditMode && selectedPreset?.needsApiKey !== false && !apiKey.trim())
      return "API Key를 입력하세요.";
    return null;
  }

  async function handleVerifyAndSelect(): Promise<void> {
    const result = await handleVerify();
    if (result && result.models.length > 0 && !model) {
      setModel(result.models[0]);
    }
  }

  async function handleSave(): Promise<void> {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert("오류", validationError);
      return;
    }
    const trimmedName = name.trim();
    const trimmedUrl = normalizeUrl(baseUrl);
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

  const presets = PROVIDER_PRESETS.filter((p) => p.id !== "custom");

  return (
    <KeyboardSafeView>
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.formContent}
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

        {!isEditMode && (
          <>
            <Text
              variant="labelMedium"
              style={[
                styles.gridLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Provider 유형
            </Text>
            <View style={styles.presetGrid}>
              {presets.map((preset) => {
                const isSelected = selectedPreset?.id === preset.id;
                const icon = PRESET_ICONS[preset.id] ?? "cloud-outline";
                return (
                  <TouchableRipple
                    key={preset.id}
                    onPress={() => handleSelectPreset(preset)}
                    style={styles.presetTouch}
                  >
                    <Surface
                      style={[
                        styles.presetCard,
                        SHADOWS.sm,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surfaceVariant,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : "transparent",
                        },
                      ]}
                      elevation={0}
                    >
                      <Icon
                        source={icon}
                        size={22}
                        color={
                          isSelected
                            ? theme.colors.primary
                            : theme.colors.onSurfaceVariant
                        }
                      />
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.presetLabel,
                          {
                            color: isSelected
                              ? theme.colors.primary
                              : theme.colors.onSurface,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.label.split(" (")[0]}
                      </Text>
                    </Surface>
                  </TouchableRipple>
                );
              })}
            </View>
          </>
        )}

        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          mode="contained"
        >
          <Card.Content>
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
  formContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  headline: { marginBottom: SPACING.xs },
  subtitle: { marginBottom: SPACING.lg },
  gridLabel: {
    marginBottom: SPACING.sm,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  presetTouch: {
    flexBasis: `${(100 / GRID_COLUMNS)}%`,
  },
  presetCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    minHeight: 72,
    gap: SPACING.xs,
  },
  presetLabel: {
    textAlign: "center",
  },
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
