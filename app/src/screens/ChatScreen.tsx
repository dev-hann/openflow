import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  FlatList,
} from "react-native";
import { Text, useTheme, IconButton } from "react-native-paper";
import { MessageList } from "../components/message-list";
import { InputBar } from "../components/InputBar";
import { KeyboardSafeView } from "../components/KeyboardSafeView";
import { ChatEmptyState } from "../components/chat-empty-state";
import { useChatStore } from "../store/chat";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";
import { useChat } from "../hooks/useChat";
import { SPACING, SHADOWS } from "../constants/theme";

export function ChatScreen() {
  const theme = useTheme();
  const [scrolledUp, setScrolledUp] = useState(false);
  const listRef = useRef<FlatList>(null);
  const messages = useChatStore((s) => s.messages);
  const isSending = useChatStore((s) => s.isSending);
  const isConnected = useAuthStore((s) => s.isConnected);
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const { sendMessage, reconnect, retryLastMessage } = useChat();

  const prevSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    if (activeSessionId && activeSessionId !== prevSessionIdRef.current) {
      setScrolledUp(false);
    }
    prevSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const themed = useMemo(
    () => ({
      background: { backgroundColor: theme.colors.background },
      surface: { backgroundColor: theme.colors.surface },
      onSurfaceVariant: { color: theme.colors.onSurfaceVariant },
    }),
    [theme.colors],
  );

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  const handleScrollToEnd = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  if (!storedAuth) {
    return (
      <ChatEmptyState
        variant="disconnected"
        isSending={false}
        onSuggestion={handleSuggestion}
        onReconnect={reconnect}
      />
    );
  }

  if (!isConnected) {
    return (
      <ChatEmptyState
        variant="connecting"
        isSending={false}
        onSuggestion={handleSuggestion}
        onReconnect={reconnect}
      />
    );
  }

  return (
    <KeyboardSafeView
      style={themed.background}
      offset={Platform.OS === "ios" ? 56 : 0}
    >
      {messages.length === 0 ? (
        <ChatEmptyState
          variant="empty"
          isSending={isSending}
          onSuggestion={handleSuggestion}
          onReconnect={reconnect}
        />
      ) : (
        <View style={styles.messageContainer}>
          <MessageList
            ref={listRef}
            messages={messages}
            onScrollStateChange={setScrolledUp}
            onRetry={retryLastMessage}
          />
          {scrolledUp && (
            <IconButton
              icon="chevron-double-down"
              size={20}
              iconColor={theme.colors.onPrimary}
              containerColor={theme.colors.primary}
              style={[styles.scrollFab, SHADOWS.md]}
              onPress={handleScrollToEnd}
              accessibilityLabel="맨 아래로 스크롤"
            />
          )}
        </View>
      )}
      {isSending && (
        <View style={[styles.streamingBar, themed.surface]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text variant="labelMedium" style={themed.onSurfaceVariant}>
            생각 중...
          </Text>
        </View>
      )}
      <InputBar onSend={sendMessage} disabled={isSending} />
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  messageContainer: { flex: 1 },
  streamingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  scrollFab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    borderRadius: 20,
    margin: 0,
  },
});
