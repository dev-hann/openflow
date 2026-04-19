import React, { useState, useMemo } from "react";
import { View, StyleSheet, Alert, ActivityIndicator } from "react-native";
import {
  Text,
  TextInput,
  Button,
  ProgressBar,
  useTheme,
} from "react-native-paper";
import { useAuthStore } from "../store/auth";
import { useSettingsStore } from "../store/settings";
import { createApiClient } from "../services/api";
import { saveAuth } from "../services/auth";
import { normalizeUrl } from "../utils/normalize-url";
import { ProviderForm } from "../components/ProviderForm";
import { KeyboardSafeView } from "../components/KeyboardSafeView";
import { SPACING } from "../constants/theme";

const STEPS: readonly string[] = ["서버", "인증", "Provider"] as const;
type Step = "server" | "pin" | "provider";

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const theme = useTheme();
  const setStoredAuth = useAuthStore((s) => s.setStoredAuth);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);

  const [step, setStep] = useState<Step>("server");
  const [inputUrl, setInputUrl] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const stepIndex = step === "server" ? 0 : step === "pin" ? 1 : 2;
  const progress = (stepIndex + 1) / STEPS.length;

  const themed = useMemo(
    () => ({
      providerBg: { backgroundColor: theme.colors.background },
      keyboardBg: { backgroundColor: theme.colors.background },
      title: {
        color: theme.colors.primary,
        textAlign: "center" as const,
        marginBottom: SPACING.xs,
      },
      subtitle: {
        color: theme.colors.onSurfaceVariant,
        textAlign: "center" as const,
        marginBottom: SPACING.xl,
      },
      progress: { marginBottom: SPACING.lg },
      stepLabel: (i: number) => ({
        color:
          i <= stepIndex ? theme.colors.primary : theme.colors.onSurfaceVariant,
        textAlign: "center" as const,
        flex: 1,
      }),
      promptTitle: {
        textAlign: "center" as const,
        marginTop: SPACING.lg,
        marginBottom: SPACING.xl,
      },
      inputMargin: { marginBottom: SPACING.md },
      flexButton: { flex: 1 },
    }),
    [theme.colors, stepIndex],
  );

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
    if (pin.trim().length !== 6) {
      Alert.alert("오류", "6자리 PIN을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const api = createApiClient(inputUrl.trim());
      const tokens = await api.pairVerify(pin.trim(), "Mobile App");
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

  if (step === "provider") {
    return (
      <View style={[styles.providerContainer, themed.providerBg]}>
        <ProgressBar progress={1} color={theme.colors.primary} />
        <ProviderForm onComplete={onComplete} showSkip />
      </View>
    );
  }

  return (
    <KeyboardSafeView style={themed.keyboardBg}>
      <View style={styles.content}>
        <Text variant="displaySmall" style={themed.title}>
          OpenFlow
        </Text>
        <Text variant="bodyLarge" style={themed.subtitle}>
          개인 AI 비서
        </Text>
        <ProgressBar
          progress={progress}
          color={theme.colors.primary}
          style={themed.progress}
        />
        <View style={styles.stepLabels}>
          {STEPS.map((label, i) => (
            <Text key={label} variant="labelSmall" style={themed.stepLabel(i)}>
              {i < stepIndex ? "✓ " : `${i + 1}. `}
              {label}
            </Text>
          ))}
        </View>
        <Text variant="titleMedium" style={themed.promptTitle}>
          {step === "server"
            ? "OpenFlow 서버 주소를 입력하세요"
            : "서버 터미널에 표시된 PIN을 입력하세요"}
        </Text>
        {step === "server" ? (
          <View>
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
              style={themed.inputMargin}
            />
            <Button
              mode="contained"
              onPress={handleConnect}
              loading={loading}
              disabled={loading}
              contentStyle={styles.buttonContent}
            >
              연결
            </Button>
          </View>
        ) : (
          <View>
            <TextInput
              label="PIN"
              placeholder="000000"
              value={pin}
              onChangeText={(text) => setPin(text.replace(/[^0-9]/g, ""))}
              mode="outlined"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              style={styles.pinInput}
            />
            <View style={styles.row}>
              <Button
                mode="outlined"
                onPress={() => {
                  setStep("server");
                  setPin("");
                }}
                style={themed.flexButton}
              >
                이전
              </Button>
              <Button
                mode="contained"
                onPress={handleVerify}
                loading={loading}
                disabled={loading || pin.length !== 6}
                style={themed.flexButton}
                contentStyle={styles.buttonContent}
              >
                인증
              </Button>
            </View>
          </View>
        )}
      </View>
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  providerContainer: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: SPACING.xl },
  stepLabels: { flexDirection: "row" },
  row: { flexDirection: "row", gap: SPACING.sm },
  buttonContent: { paddingVertical: SPACING.xs },
  pinInput: { marginBottom: SPACING.md, textAlign: "center" },
});
