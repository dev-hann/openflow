import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { useTheme, SPACING, TYPOGRAPHY } from "../constants/theme";
import { useSessionsStore } from "../store/sessions";
import { useAuthStore } from "../store/auth";
import { createApiClient } from "../services/api";
import type { SessionInfo } from "../types/protocol";

export function DrawerContent() {
  const colors = useTheme();
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const addSession = useSessionsStore((s) => s.addSession);
  const removeSession = useSessionsStore((s) => s.removeSession);
  const storedAuth = useAuthStore((s) => s.storedAuth);

  const handleNewSession = React.useCallback(async () => {
    if (!storedAuth) return;
    try {
      const api = createApiClient(storedAuth.serverUrl);
      const session = await api.createSession(storedAuth.accessToken);
      addSession(session as unknown as SessionInfo);
      setActiveSessionId(session.id);
    } catch {
      Alert.alert("오류", "세션 생성에 실패했습니다.");
    }
  }, [storedAuth, addSession, setActiveSessionId]);

  const handleDeleteSession = React.useCallback(
    (session: SessionInfo) => {
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

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.newButton, { backgroundColor: colors.primary }]}
        onPress={handleNewSession}
      >
        <Text style={[styles.newButtonText, { color: colors.textInverse }]}>+ 새 세션</Text>
      </TouchableOpacity>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.sessionItem,
              item.id === activeSessionId && { backgroundColor: colors.surfaceAlt },
            ]}
            onPress={() => setActiveSessionId(item.id)}
            onLongPress={() => handleDeleteSession(item)}
          >
            <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
              {formatTime(item.updatedAt)} · {item.messageCount}개
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            세션이 없습니다
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING.lg,
  },
  newButton: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 10,
    alignItems: "center",
  },
  newButtonText: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: SPACING.sm,
  },
  sessionItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 10,
    marginBottom: SPACING.xs,
  },
  sessionTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: "500",
  },
  sessionMeta: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
    textAlign: "center",
    marginTop: SPACING.xl,
  },
});
