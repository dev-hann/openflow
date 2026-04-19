import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY } from "../constants/theme";
import { MessageList } from "../components/MessageBubble";
import { InputBar } from "../components/InputBar";
import { useChatStore } from "../store/chat";
import { useAuthStore } from "../store/auth";
import { useChat } from "../hooks/useChat";

export function ChatScreen() {
  const messages = useChatStore((s) => s.messages);
  const isSending = useChatStore((s) => s.isSending);
  const isConnected = useAuthStore((s) => s.isConnected);
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const { sendMessage } = useChat();

  if (!storedAuth) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>설정 탭에서 서버에 연결하세요</Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>서버에 연결 중...</Text>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.welcomeText}>OpenFlow에 오신 것을 환영합니다!</Text>
          <Text style={styles.emptyHint}>무엇이든 물어보세요.</Text>
        </View>
        <InputBar onSend={sendMessage} disabled={isSending} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MessageList messages={messages} />
      <InputBar onSend={sendMessage} disabled={isSending} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
  },
  welcomeText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  emptyHint: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
