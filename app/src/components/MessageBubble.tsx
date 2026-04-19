import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { COLORS, SPACING, TYPOGRAPHY } from "../constants/theme";

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
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text style={[styles.text, isUser && styles.userText]}>
          {message.content || (message.isStreaming ? "..." : "")}
        </Text>
        {message.isStreaming && (
          <Text style={styles.streamingIndicator}> ●</Text>
        )}
      </View>
    </View>
  );
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      contentContainerStyle={styles.listContent}
      inverted={false}
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
    paddingVertical: SPACING.sm,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: COLORS.userBg,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: COLORS.assistantBg,
    borderBottomLeftRadius: 4,
  },
  text: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  userText: {
    color: COLORS.textInverse,
  },
  streamingIndicator: {
    color: COLORS.primary,
    fontSize: 10,
  },
  listContent: {
    paddingVertical: SPACING.md,
  },
});
