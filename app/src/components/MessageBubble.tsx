import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useTheme, SPACING, TYPOGRAPHY } from "../constants/theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useTheme();
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.userBg, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.assistantBg, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[styles.text, { color: isUser ? colors.textInverse : colors.text }]}>
          {message.content || (message.isStreaming ? "" : "")}
        </Text>
        {message.isStreaming && !message.content && (
          <View style={styles.typingDots}>
            <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
          </View>
        )}
      </View>
    </View>
  );
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const colors = useTheme();

  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      contentContainerStyle={[styles.listContent, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="interactive"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 16,
  },
  text: {
    ...TYPOGRAPHY.body,
    lineHeight: 20,
  },
  typingDots: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listContent: {
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
  },
});
