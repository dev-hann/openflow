import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TouchableWithoutFeedback,
  TextInput as RNTextInput,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Icon,
  useTheme,
  TouchableRipple,
} from "react-native-paper";
import { useAuthStore } from "../store/auth";
import { useSettingsStore } from "../store/settings";
import { createApiClient } from "../services/api";
import { saveAuth } from "../services/auth";
import { normalizeUrl } from "../utils/normalize-url";
import { ProviderForm } from "../components/ProviderForm";
import { KeyboardSafeView } from "../components/KeyboardSafeView";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { PROVIDER_PRESETS } from "../constants/presets";
import type { ProviderPreset } from "../constants/presets";

type Step = "server" | "pin" | "provider" | "provider-manual";

const GRID_ITEMS = [
  { id: "openai", emoji: "🟢" },
  { id: "anthropic", emoji: "🟣" },
  { id: "google", emoji: "🔵" },
  { id: "groq", emoji: "🟠" },
  { id: "deepseek", emoji: "🔴" },
  { id: "ollama", emoji: "🐑" },
].map(({ id, emoji }) => ({
  preset: PROVIDER_PRESETS.find((p) => p.id === id)!,
  emoji,
}));

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const theme = useTheme();
  const setStoredAuth = useAuthStore((s) => s.setStoredAuth);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const getValidToken = useAuthStore((s) => s.getValidToken);
  const storedAuth = useAuthStore((s) => s.storedAuth);

  const [step, setStep] = useState<Step>("server");
  const [inputUrl, setInputUrl] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(
    null,
  );
  const [presetName, setPresetName] = useState("");
  const [presetBaseUrl, setPresetBaseUrl] = useState("");
  const [presetApiKey, setPresetApiKey] = useState("");
  const pinRef = useRef<RNTextInput>(null);

  async function handleConnect(): Promise<void> {
    if (!inputUrl.trim()) {
      Alert.alert("오류", "서버 주소를 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const api = createApiClient(inputUrl.trim());
      await api.pairInit();
      setStep("pin");
    } catch (err) {
      Alert.alert(
        "연결 실패",
        err instanceof Error ? err.message : "서버에 연결할 수 없습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(): Promise<void> {
    if (pin.length !== 6) {
      Alert.alert("오류", "6자리 PIN을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const api = createApiClient(inputUrl.trim());
      const tokens = await api.pairVerify(pin, "Mobile App");
      const serverUrl = normalizeUrl(inputUrl.trim());
      const auth = { serverUrl, ...tokens };
      await saveAuth(auth);
      setStoredAuth(auth);
      setServerUrl(serverUrl);
      setStep("provider");
    } catch (err) {
      Alert.alert(
        "인증 실패",
        err instanceof Error ? err.message : "PIN이 올바르지 않습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSelectPreset(preset: ProviderPreset): void {
    setSelectedPreset(preset);
    setPresetName(preset.label.split(" (")[0]);
    setPresetBaseUrl(preset.baseUrl);
    setPresetApiKey("");
  }

  async function handleSavePreset(): Promise<void> {
    if (!presetName.trim() || !presetBaseUrl.trim()) {
      Alert.alert("오류", "필수 정보를 입력하세요.");
      return;
    }
    if (selectedPreset?.needsApiKey !== false && !presetApiKey.trim()) {
      Alert.alert("오류", "API Key를 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token || !storedAuth) {
        Alert.alert("오류", "인증 정보가 없습니다.");
        return;
      }
      const api = createApiClient(storedAuth.serverUrl);
      await api.createProvider(token, {
        name: presetName.trim(),
        baseUrl: normalizeUrl(presetBaseUrl) || presetBaseUrl.trim(),
        apiKey: presetApiKey.trim(),
        model: "default",
        isDefault: true,
      });
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

  if (step === "provider-manual") {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <ProviderForm onComplete={onComplete} showSkip />
      </View>
    );
  }

  if (step === "provider") {
    return (
      <KeyboardSafeView style={{ backgroundColor: theme.colors.background }}>
        <View style={styles.content}>
          <Text
            variant="titleMedium"
            style={[
              styles.centerText,
              { color: theme.colors.tertiary, marginBottom: SPACING.sm },
            ]}
          >
            ✅ 인증 완료!
          </Text>
          <Text
            variant="titleMedium"
            style={[styles.centerText, { marginBottom: SPACING.xl }]}
          >
            AI 어시스턴트를 설정하세요
          </Text>

          {selectedPreset ? (
            <View>
              <Text
                variant="labelLarge"
                style={{
                  marginBottom: SPACING.sm,
                  color: theme.colors.primary,
                }}
              >
                {selectedPreset.label}
              </Text>
              <TextInput
                label="이름"
                value={presetName}
                onChangeText={setPresetName}
                mode="outlined"
                style={styles.field}
              />
              <TextInput
                label="Base URL"
                value={presetBaseUrl}
                onChangeText={setPresetBaseUrl}
                mode="outlined"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.field}
              />
              {selectedPreset.needsApiKey !== false && (
                <TextInput
                  label="API Key"
                  placeholder="sk-..."
                  value={presetApiKey}
                  onChangeText={setPresetApiKey}
                  mode="outlined"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.field}
                />
              )}
              <View style={styles.row}>
                <Button
                  mode="outlined"
                  onPress={() => setSelectedPreset(null)}
                  style={styles.flexBtn}
                >
                  이전
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSavePreset}
                  loading={loading}
                  disabled={loading}
                  style={styles.flexBtn}
                >
                  저장
                </Button>
              </View>
            </View>
          ) : (
            <>
              <Text variant="labelLarge" style={{ marginBottom: SPACING.sm }}>
                프리셋 선택:
              </Text>
              <View style={styles.grid}>
                {GRID_ITEMS.map(({ preset, emoji }) => (
                  <TouchableRipple
                    key={preset.id}
                    onPress={() => handleSelectPreset(preset)}
                    style={[
                      styles.presetCard,
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                    borderless
                  >
                    <View style={styles.presetCardContent}>
                      <Text style={styles.presetEmoji}>{emoji}</Text>
                      <Text
                        variant="labelLarge"
                        style={{ textAlign: "center" }}
                      >
                        {preset.label}
                      </Text>
                    </View>
                  </TouchableRipple>
                ))}
              </View>
              <Button
                mode="text"
                onPress={() => setStep("provider-manual")}
                style={styles.manualBtn}
              >
                직접 입력하기 →
              </Button>
            </>
          )}

          <Button mode="text" onPress={onComplete} style={styles.skipBtn}>
            나중에 설정하기
          </Button>
        </View>
      </KeyboardSafeView>
    );
  }

  if (step === "pin") {
    return (
      <KeyboardSafeView style={{ backgroundColor: theme.colors.background }}>
        <TouchableWithoutFeedback onPress={() => pinRef.current?.focus()}>
          <View style={styles.content}>
            <View style={styles.iconCenter}>
              <Icon
                source="check-circle"
                size={48}
                color={theme.colors.tertiary}
              />
            </View>
            <Text
              variant="titleMedium"
              style={[styles.centerText, { marginBottom: SPACING.xl }]}
            >
              서버에 표시된 PIN을{"\n"}입력하세요
            </Text>
            <RNTextInput
              ref={pinRef}
              value={pin}
              onChangeText={(text) =>
                setPin(text.replace(/[^0-9]/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              caretHidden
              style={styles.hiddenInput}
            />
            <View style={styles.pinRow}>
              {Array.from({ length: 6 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pinBox,
                    {
                      borderColor:
                        i === pin.length
                          ? theme.colors.primary
                          : theme.colors.outline,
                      backgroundColor:
                        i < pin.length
                          ? theme.colors.surfaceVariant
                          : "transparent",
                    },
                  ]}
                >
                  <Text variant="headlineSmall" style={styles.centerText}>
                    {pin[i] || ""}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              variant="bodySmall"
              style={[
                styles.centerText,
                {
                  color: theme.colors.onSurfaceVariant,
                  marginBottom: SPACING.xl,
                },
              ]}
            >
              6자리 숫자를 입력하세요
            </Text>
            <View style={styles.row}>
              <Button
                mode="outlined"
                onPress={() => {
                  setStep("server");
                  setPin("");
                }}
                style={styles.flexBtn}
              >
                이전
              </Button>
              <Button
                mode="contained"
                onPress={handleVerify}
                loading={loading}
                disabled={loading || pin.length !== 6}
                style={styles.flexBtn}
              >
                인증
              </Button>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardSafeView>
    );
  }

  return (
    <KeyboardSafeView style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.content}>
        <View style={styles.iconCenter}>
          <Icon
            source="robot-happy-outline"
            size={64}
            color={theme.colors.primary}
          />
        </View>
        <Text
          variant="displaySmall"
          style={[
            styles.centerText,
            { color: theme.colors.primary, marginBottom: SPACING.xs },
          ]}
        >
          OpenFlow
        </Text>
        <Text
          variant="bodyLarge"
          style={[
            styles.centerText,
            {
              color: theme.colors.onSurfaceVariant,
              marginBottom: SPACING.xxl,
            },
          ]}
        >
          개인 AI 비서
        </Text>
        <Text
          variant="titleMedium"
          style={[styles.centerText, { marginBottom: SPACING.xl }]}
        >
          서버 주소를 입력하세요
        </Text>
        <TextInput
          label="서버 주소"
          placeholder="예: http://192.168.0.5:9800"
          value={inputUrl}
          onChangeText={setInputUrl}
          mode="outlined"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          autoFocus
          style={{ marginBottom: SPACING.md }}
        />
        <Button
          mode="contained"
          onPress={handleConnect}
          loading={loading}
          disabled={loading}
          contentStyle={styles.btnContent}
          style={{ marginBottom: SPACING.lg }}
        >
          연결하기
        </Button>
        <Text
          variant="bodySmall"
          style={[
            styles.centerText,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          로컬 네트워크의 OpenFlow{"\n"}서버 주소를 입력하세요
        </Text>
      </View>
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  centerText: { textAlign: "center" },
  iconCenter: { alignItems: "center", marginBottom: SPACING.lg },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1,
  },
  pinRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pinBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", gap: SPACING.sm },
  flexBtn: { flex: 1 },
  btnContent: { paddingVertical: SPACING.xs },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  presetCard: {
    width: "48%",
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  presetCardContent: { alignItems: "center", gap: SPACING.xs },
  presetEmoji: { fontSize: 24 },
  field: { marginBottom: SPACING.sm },
  manualBtn: { marginTop: SPACING.md },
  skipBtn: { marginTop: SPACING.md },
});
