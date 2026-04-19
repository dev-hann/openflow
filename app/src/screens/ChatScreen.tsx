import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useTheme, SPACING, TYPOGRAPHY } from "../constants/theme";
import { MessageList } from "../components/MessageBubble";
import { InputBar } from "../components/InputBar";
import { SessionModal } from "../drawer/DrawerContent";
import { useChatStore } from "../store/chat";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";
import { useChat } from "../hooks/useChat";

export function ChatScreen() {
  const colors = useTheme();
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const messages = useChatStore((s) => s.messages);
  const isSending = useChatStore((s) => s.isSending);
  const isConnected = useAuthStore((s) => s.isConnected);
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const { sendMessage } = useChat();

  if (!storedAuth) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 40, marginBottom: SPACING.md }}>🔗</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>서버에 연결되지 않았습니다</Text>
        <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
          설정 탭에서 서버에 연결하세요
        </Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.emptyHint, { color: colors.textSecondary, marginTop: SPACING.md }]}>
          서버에 연결 중...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {activeSessionId && (
        <TouchableOpacity
          style={[styles.sessionBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          onPress={() => setSessionModalVisible(true)}
        >
          <Text style={[styles.sessionBarText, { color: colors.textSecondary }]}>
            세션: {activeSessionId.slice(0, 8)}...
          </Text>
          <Text style={[styles.sessionBarAction, { color: colors.primary }]}>전환</Text>
        </TouchableOpacity>
      )}
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 48, marginBottom: SPACING.lg }}>🤖</Text>
          <Text style={[styles.welcomeText, { color: colors.text }]}>OpenFlow에 오신 것을 환영합니다!</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            무엇이든 물어보세요.
          </Text>
        </View>
      ) : (
        <MessageList messages={messages} />
      )}
      {isSending && (
        <View style={[styles.streamingBar, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.streamingText, { color: colors.textSecondary }]}>생각 중...</Text>
        </View>
      )}
      <InputBar onSend={sendMessage} disabled={isSending} />
      <SessionModal visible={sessionModalVisible} onClose={() => setSessionModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
  },
  welcomeText: {
    ...TYPOGRAPHY.title,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  emptyTitle: {
    ...TYPOGRAPHY.subtitle,
    marginBottom: SPACING.xs,
  },
  emptyHint: {
    ...TYPOGRAPHY.body,
  },
  sessionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
  },
  sessionBarText: {
    ...TYPOGRAPHY.caption,
  },
  sessionBarAction: {
    ...TYPOGRAPHY.caption,
    fontWeight: "600",
  },
  streamingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  streamingText: {
    ...TYPOGRAPHY.caption,
    fontStyle: "italic",
  },
});
