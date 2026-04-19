import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { useTheme, SPACING, TYPOGRAPHY } from "../constants/theme";
import { useSessionsStore } from "../store/sessions";
import { useAuthStore } from "../store/auth";
import { createApiClient } from "../services/api";
import type { SessionInfo } from "../types/protocol";

interface SessionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SessionModal({ visible, onClose }: SessionModalProps) {
  const colors = useTheme();
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const addSession = useSessionsStore((s) => s.addSession);
  const removeSession = useSessionsStore((s) => s.removeSession);
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const getValidToken = useAuthStore((s) => s.getValidToken);

  const handleNewSession = React.useCallback(async () => {
    if (!storedAuth) return;
    const token = await getValidToken();
    if (!token) return;
    try {
      const api = createApiClient(storedAuth.serverUrl);
      const session = await api.createSession(token);
      const now = Date.now();
      addSession({
        id: session.id,
        title: session.title,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      });
      setActiveSessionId(session.id);
    } catch {
      Alert.alert("오류", "세션 생성에 실패했습니다.");
    }
  }, [storedAuth, getValidToken, addSession, setActiveSessionId]);

  const handleDeleteSession = React.useCallback(
    (session: SessionInfo) => {
      if (!storedAuth) return;
      Alert.alert("세션 삭제", `"${session.title}" 세션을 삭제하시겠습니까?`, [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            const token = await getValidToken();
            if (!token) return;
            try {
              const api = createApiClient(storedAuth.serverUrl);
              await api.deleteSession(token, session.id);
              removeSession(session.id);
              if (activeSessionId === session.id) setActiveSessionId(null);
            } catch {
              Alert.alert("오류", "세션 삭제에 실패했습니다.");
            }
          },
        },
      ]);
    },
    [storedAuth, getValidToken, removeSession, activeSessionId, setActiveSessionId],
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.primary }]}>닫기</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>세션</Text>
          <TouchableOpacity onPress={handleNewSession} style={styles.addButton}>
            <Text style={[styles.addButtonText, { color: colors.primary }]}>+ 새 세션</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.sessionItem,
                {
                  backgroundColor: item.id === activeSessionId ? colors.surfaceAlt : "transparent",
                },
              ]}
              onPress={() => {
                setActiveSessionId(item.id);
                onClose();
              }}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: "600",
  },
  closeButton: {
    padding: SPACING.xs,
  },
  closeText: {
    ...TYPOGRAPHY.body,
  },
  addButton: {
    padding: SPACING.xs,
  },
  addButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
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
