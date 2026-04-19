import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme, SPACING, TYPOGRAPHY } from "../constants/theme";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";
import { useSettingsStore } from "../store/settings";
import { createApiClient } from "../services/api";
import { saveAuth, clearAuth } from "../services/auth";
import type { SessionInfo } from "../types/protocol";

export function SettingsScreen() {
  const colors = useTheme();
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const setStoredAuth = useAuthStore((s) => s.setStoredAuth);
  const isConnected = useAuthStore((s) => s.isConnected);
  const getValidToken = useAuthStore((s) => s.getValidToken);
  const setSessions = useSessionsStore((s) => s.setSessions);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const currentModel = useSettingsStore((s) => s.currentModel);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const setCurrentModel = useSettingsStore((s) => s.setCurrentModel);
  const setAvailableModels = useSettingsStore((s) => s.setAvailableModels);

  const [inputUrl, setInputUrl] = useState(storedAuth?.serverUrl ?? "");
  const [pin, setPin] = useState("");
  const [pairing, setPairing] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshData = useCallback(async () => {
    const token = await getValidToken();
    const auth = useAuthStore.getState().storedAuth;
    if (!token || !auth) return;
    try {
      const api = createApiClient(auth.serverUrl);
      const [sessions, modelInfo] = await Promise.all([
        api.listSessions(token),
        api.listModels(token),
      ]);
      setSessions(sessions);
      setAvailableModels(modelInfo.models);
      setCurrentModel(modelInfo.current);
    } catch {
      // token might be expired
    }
  }, [getValidToken, setSessions, setAvailableModels, setCurrentModel]);

  useEffect(() => {
    if (storedAuth) {
      setInputUrl(storedAuth.serverUrl);
      refreshData();
    }
  }, [storedAuth, refreshData]);

  async function handlePairInit(): Promise<void> {
    if (!inputUrl.trim()) {
      Alert.alert("오류", "서버 주소를 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const api = createApiClient(inputUrl.trim());
      await api.pairInit();
      setPairing(true);
    } catch (err) {
      Alert.alert("연결 실패", err instanceof Error ? err.message : "서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePairVerify(): Promise<void> {
    if (pin.trim().length !== 6) {
      Alert.alert("오류", "6자리 PIN을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const api = createApiClient(inputUrl.trim());
      const tokens = await api.pairVerify(pin.trim(), "Mobile App");
      const auth = { serverUrl: inputUrl.trim(), ...tokens };
      await saveAuth(auth);
      setStoredAuth(auth);
      setPairing(false);
      setPin("");
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
          const token = await getValidToken();
          if (token) {
            try {
              const api = createApiClient(storedAuth.serverUrl);
              await api.unpair(token);
            } catch {
              // clear local anyway
            }
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
    const token = await getValidToken();
    if (!token || !storedAuth) return;
    try {
      const api = createApiClient(storedAuth.serverUrl);
      await api.switchModel(token, model);
      setCurrentModel(model);
    } catch {
      Alert.alert("오류", "모델 변경에 실패했습니다.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>연결</Text>
        {!storedAuth ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="서버 주소 (예: http://192.168.0.5:9800)"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!pairing}
            />
            {!pairing ? (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handlePairInit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.textInverse }]}>연결</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={[styles.pinHint, { color: colors.textSecondary }]}>
                  서버 터미널에 표시된 PIN을 입력하세요
                </Text>
                <TextInput
                  style={[styles.pinInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={pin}
                  onChangeText={setPin}
                  placeholder="000000"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.buttonHalf, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    onPress={() => { setPairing(false); setPin(""); }}
                  >
                    <Text style={[styles.buttonText, { color: colors.text }]}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.buttonHalf, { backgroundColor: colors.primary }]}
                    onPress={handlePairVerify}
                    disabled={loading || pin.length !== 6}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.textInverse} />
                    ) : (
                      <Text style={[styles.buttonText, { color: colors.textInverse }]}>인증</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>서버</Text>
              <Text style={[styles.value, { color: colors.text }]}>{storedAuth.serverUrl}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>상태</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.success : colors.error }]} />
                <Text style={[styles.value, { color: colors.text }]}>
                  {isConnected ? "연결됨" : "연결 끊김"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.dangerButton, { borderColor: colors.error }]}
              onPress={handleUnpair}
            >
              <Text style={{ color: colors.error, ...TYPOGRAPHY.body }}>페어링 해제</Text>
            </TouchableOpacity>
          </View>
        )}

        {storedAuth && availableModels.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>모델</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {availableModels.map((model) => (
                <TouchableOpacity
                  key={model}
                  style={[
                    styles.modelItem,
                    {
                      backgroundColor: model === currentModel ? colors.primary : colors.inputBg,
                    },
                  ]}
                  onPress={() => handleModelChange(model)}
                >
                  <Text
                    style={{
                      ...TYPOGRAPHY.body,
                      color: model === currentModel ? colors.textInverse : colors.text,
                    }}
                  >
                    {model}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {storedAuth && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>정보</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>버전</Text>
                <Text style={[styles.value, { color: colors.text }]}>1.0.0</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  sectionTitle: {
    ...TYPOGRAPHY.subtitle,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  card: {
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
  label: { ...TYPOGRAPHY.body },
  value: { ...TYPOGRAPHY.body },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  input: {
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 15,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  pinInput: {
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 28,
    textAlign: "center",
    letterSpacing: 12,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  pinHint: {
    ...TYPOGRAPHY.caption,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  button: {
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    alignItems: "center",
  },
  buttonHalf: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    alignItems: "center",
    borderWidth: 1,
  },
  buttonText: { ...TYPOGRAPHY.subtitle },
  dangerButton: {
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    alignItems: "center",
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  modelItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
});
