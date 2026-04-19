import React, {
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
  useMemo,
  useEffect,
} from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  FlatList,
} from "react-native";
import { Text, useTheme, Icon, IconButton } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { MessageList } from "../components/message-list";
import { InputBar } from "../components/InputBar";
import { KeyboardSafeView } from "../components/KeyboardSafeView";
import { SessionModal } from "../components/session-modal";
import { ChatEmptyState } from "../components/chat-empty-state";
import { useChatStore } from "../store/chat";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";
import { useChat } from "../hooks/useChat";
import { SPACING, SHADOWS } from "../constants/theme";

export function ChatScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [scrolledUp, setScrolledUp] = useState(false);
  const listRef = useRef<FlatList>(null);
  const messages = useChatStore((s) => s.messages);
  const isSending = useChatStore((s) => s.isSending);
  const isConnected = useAuthStore((s) => s.isConnected);
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const sessions = useSessionsStore((s) => s.sessions);
  const { sendMessage, switchSession, reconnect, retryLastMessage } = useChat();

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );
  const sessionTitle = activeSession?.title ?? "새 대화";

  useEffect(() => {
    setScrolledUp(false);
  }, [activeSessionId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerTitle}
          onPress={() => setSessionModalVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="세션 선택"
          accessibilityHint="세션 목록을 엽니다"
          accessibilityRole="button"
        >
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={[styles.headerTitleText, { color: theme.colors.onSurface }]}
          >
            {sessionTitle}
          </Text>
          <Icon
            source="chevron-down"
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, sessionTitle, theme]);

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
      style={{ backgroundColor: theme.colors.background }}
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
              style={[styles.scrollFab, { ...SHADOWS.md }]}
              onPress={handleScrollToEnd}
              accessibilityLabel="맨 아래로 스크롤"
            />
          )}
        </View>
      )}
      {isSending && (
        <View
          style={[
            styles.streamingBar,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            생각 중...
          </Text>
        </View>
      )}
      <InputBar onSend={sendMessage} disabled={isSending} />
      <SessionModal
        visible={sessionModalVisible}
        onClose={() => setSessionModalVisible(false)}
        onSwitchSession={switchSession}
      />
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerTitleText: { fontWeight: "600", maxWidth: 200 },
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
