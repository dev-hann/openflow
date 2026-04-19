import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { COLORS, SPACING, TYPOGRAPHY } from "../constants/theme";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";
import { useSettingsStore } from "../store/settings";
import { createApiClient, ApiError } from "../services/api";
import { saveAuth, clearAuth } from "../services/auth";
import type { SessionInfo } from "../types/protocol";

export function SettingsScreen() {
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const setStoredAuth = useAuthStore((s) => s.setStoredAuth);
  const isConnected = useAuthStore((s) => s.isConnected);

  const setSessions = useSessionsStore((s) => s.setSessions);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);

  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const currentModel = useSettingsStore((s) => s.currentModel);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const setCurrentModel = useSettingsStore((s) => s.setCurrentModel);
  const setAvailableModels = useSettingsStore((s) => s.setAvailableModels);
  const serverVersion = useSettingsStore((s) => s.serverVersion);
  const setServerVersion = useSettingsStore((s) => s.setServerVersion);

  const [inputUrl, setInputUrl] = useState(storedAuth?.serverUrl ?? "");
  const [pin, setPin] = useState("");
  const [pairingPin, setPairingPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (storedAuth) {
      setInputUrl(storedAuth.serverUrl);
      refreshData();
    }
  }, []);

  async function refreshData(): Promise<void> {
    if (!storedAuth) return;
    try {
      const api = createApiClient(storedAuth.serverUrl);
      const [sessions, modelInfo] = await Promise.all([
        api.listSessions(storedAuth.accessToken),
        api.listModels(storedAuth.accessToken),
      ]);
      setSessions(sessions as unknown as SessionInfo[]);
      setAvailableModels(modelInfo.models);
      setCurrentModel(modelInfo.current);
    } catch {
      // token might be expired, try refresh
    }
  }

  async function handlePairInit(): Promise<void> {
    if (!inputUrl.trim()) {
      Alert.alert("오류", "서버 주소를 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const api = createApiClient(inputUrl.trim());
      await api.pairInit();
      setPairingPin("pending");
    } catch (err) {
      Alert.alert("연결 실패", err instanceof Error ? err.message : "서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePairVerify(): Promise<void> {
    if (!pin.trim() || pin.trim().length !== 6) {
      Alert.alert("오류", "6자리 PIN을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const api = createApiClient(inputUrl.trim());
      const tokens = await api.pairVerify(pin.trim(), "Mobile App");
      const auth = {
        serverUrl: inputUrl.trim(),
        ...tokens,
      };
      await saveAuth(auth);
      setStoredAuth(auth);
      setPairingPin(null);
      setPin("");
      await refreshData();
    } catch (err) {
      Alert.alert("인증 실패", err instanceof Error ? err.message : "PIN이 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnpair(): Promise<void> {
    if (!storedAuth) return;
    Alert.alert("페어링 해제", "이 기기의 페어링을 해제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "해제",
        style: "destructive",
        onPress: async () => {
          try {
            const api = createApiClient(storedAuth.serverUrl);
            await api.unpair(storedAuth.accessToken);
          } catch {
            // ignore, clear local anyway
          }
          await clearAuth();
          setStoredAuth(null);
          setSessions([]);
          setActiveSessionId(null);
        },
      },
    ]);
  }

  async function handleModelChange(model: string): Promise<void> {
    if (!storedAuth) return;
    try {
      const api = createApiClient(storedAuth.serverUrl);
      await api.switchModel(storedAuth.accessToken, model);
      setCurrentModel(model);
    } catch (err) {
      Alert.alert("오류", "모델 변경에 실패했습니다.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 연결 섹션 */}
      <Text style={styles.sectionTitle}>연결</Text>
      {!storedAuth ? (
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="서버 주소 (예: 192.168.0.5:9800)"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {!pairingPin ? (
            <TouchableOpacity style={styles.button} onPress={handlePairInit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.textInverse} />
              ) : (
                <Text style={styles.buttonText}>연결</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View>
              <Text style={styles.pinHint}>
                서버 터미널에 표시된 PIN을 입력하세요
              </Text>
              <TextInput
                style={styles.pinInput}
                value={pin}
                onChangeText={setPin}
                placeholder="6자리 PIN"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity style={styles.button} onPress={handlePairVerify} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={COLORS.textInverse} />
                ) : (
                  <Text style={styles.buttonText}>인증</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>서버</Text>
            <Text style={styles.value}>{storedAuth.serverUrl}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>상태</Text>
            <View style={styles.statusRow}>
              <View
                style={[styles.statusDot, isConnected ? styles.statusConnected : styles.statusDisconnected]}
              />
              <Text style={styles.value}>{isConnected ? "연결됨" : "연결 끊김"}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.dangerButton} onPress={handleUnpair}>
            <Text style={styles.dangerButtonText}>페어링 해제</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 모델 섹션 */}
      {storedAuth && availableModels.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>모델</Text>
          <View style={styles.card}>
            <Text style={styles.label}>현재: {currentModel}</Text>
            {availableModels.map((model) => (
              <TouchableOpacity
                key={model}
                style={[styles.modelItem, model === currentModel && styles.modelItemActive]}
                onPress={() => handleModelChange(model)}
              >
                <Text style={[styles.modelText, model === currentModel && styles.modelTextActive]}>
                  {model}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* 정보 섹션 */}
      {storedAuth && (
        <>
          <Text style={styles.sectionTitle}>정보</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>버전</Text>
              <Text style={styles.value}>1.0.0</Text>
            </View>
            {serverVersion ? (
              <View style={styles.row}>
                <Text style={styles.label}>서버</Text>
                <Text style={styles.value}>{serverVersion}</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  label: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  value: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusConnected: {
    backgroundColor: COLORS.success,
  },
  statusDisconnected: {
    backgroundColor: COLORS.error,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  pinInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 24,
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: SPACING.sm,
  },
  pinHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  buttonText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.textInverse,
  },
  dangerButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.error,
    marginTop: SPACING.sm,
  },
  dangerButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
  },
  modelItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  modelItemActive: {
    backgroundColor: COLORS.primary,
  },
  modelText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  modelTextActive: {
    color: COLORS.textInverse,
  },
});
