import React, { useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY } from "../constants/theme";
import { useSessionsStore } from "../store/sessions";
import { useAuthStore } from "../store/auth";
import { createApiClient } from "../services/api";
import type { SessionInfo } from "../types/protocol";

export function DrawerContent() {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const addSession = useSessionsStore((s) => s.addSession);
  const removeSession = useSessionsStore((s) => s.removeSession);
  const storedAuth = useAuthStore((s) => s.storedAuth);

  const handleNewSession = useCallback(async () => {
    if (!storedAuth) return;
    try {
      const api = createApiClient(storedAuth.serverUrl);
      const session = await api.createSession(storedAuth.accessToken);
      addSession(session as unknown as SessionInfo);
      setActiveSessionId(session.id);
    } catch (err) {
      Alert.alert("오류", "세션 생성에 실패했습니다.");
    }
  }, [storedAuth, addSession, setActiveSessionId]);

  const handleDeleteSession = useCallback(
    async (session: SessionInfo) => {
      if (!storedAuth) return;
      Alert.alert("세션 삭제", `"${session.title}" 세션을 삭제하시겠습니까?`, [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              const api = createApiClient(storedAuth.serverUrl);
              await api.deleteSession(storedAuth.accessToken, session.id);
              removeSession(session.id);
              if (activeSessionId === session.id) setActiveSessionId(null);
            } catch {
              Alert.alert("오류", "세션 삭제에 실패했습니다.");
            }
          },
        },
      ]);
    },
    [storedAuth, removeSession, activeSessionId, setActiveSessionId],
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.newButton} onPress={handleNewSession}>
        <Text style={styles.newButtonText}>+ 새 세션</Text>
      </TouchableOpacity>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.sessionItem, item.id === activeSessionId && styles.sessionItemActive]}
            onPress={() => setActiveSessionId(item.id)}
            onLongPress={() => handleDeleteSession(item)}
          >
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.sessionMeta}>
              {new Date(item.updatedAt).toLocaleDateString()} · {item.messageCount}개
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.lg,
  },
  newButton: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: "center",
  },
  newButtonText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.textInverse,
  },
  listContent: {
    paddingHorizontal: SPACING.sm,
  },
  sessionItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.xs,
  },
  sessionItemActive: {
    backgroundColor: COLORS.surface,
  },
  sessionTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  sessionMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
