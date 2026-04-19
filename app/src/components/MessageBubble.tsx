import React, { useMemo, useState, useCallback } from "react";
import { View, StyleSheet, Clipboard } from "react-native";
import { Text, useTheme, Icon, TouchableRipple } from "react-native-paper";
import Markdown from "react-native-markdown-display";
import { TypingIndicator } from "./typing-indicator";
import { SPACING, SHADOWS, BORDER_RADIUS } from "../constants/theme";
import type { ChatMessage } from "../store/chat";
import { formatTime } from "../utils/format-time";

const MAX_ACCESSIBILITY_LENGTH = 150;

function formatTimestampLabel(message: ChatMessage): string {
  return message.isFailed ? "전송 실패" : formatTime(message.timestamp);
}

function truncateForAccessibility(text: string): string {
  if (text.length <= MAX_ACCESSIBILITY_LENGTH) return text;
  return text.slice(0, MAX_ACCESSIBILITY_LENGTH).trimEnd() + "…";
}

interface MessageBubbleProps {
  message: ChatMessage;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onRetry?: (content: string) => void;
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isFirstInGroup,
  isLastInGroup,
  onRetry,
}: MessageBubbleProps) {
  const theme = useTheme();
  const isUser = message.role === "user";
  const accessibilityContent = truncateForAccessibility(message.content);

  const codeBlockStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.surfaceVariant,
      color: theme.colors.onSurface,
      borderRadius: 8,
      padding: 12,
      fontSize: 13,
    }),
    [theme.colors],
  );

  const mdStyles = useMemo(
    () => ({
      body: { color: theme.colors.onSurface, fontSize: 15, lineHeight: 22 },
      paragraph: { margin: 0, marginBottom: 6 },
      heading1: {
        color: theme.colors.onSurface,
        fontSize: 20,
        fontWeight: "bold" as const,
        marginTop: 8,
        marginBottom: 4,
      },
      heading2: {
        color: theme.colors.onSurface,
        fontSize: 17,
        fontWeight: "bold" as const,
        marginTop: 6,
        marginBottom: 3,
      },
      heading3: {
        color: theme.colors.onSurface,
        fontSize: 15,
        fontWeight: "bold" as const,
        marginTop: 4,
        marginBottom: 2,
      },
      code_inline: {
        backgroundColor: theme.colors.surfaceVariant,
        color: theme.colors.onSurface,
        fontSize: 13,
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
      },
      code_block: codeBlockStyle,
      fence: codeBlockStyle,
      bullet_list: { marginVertical: 2 },
      ordered_list: { marginVertical: 2 },
      blockquote: {
        backgroundColor: theme.colors.surfaceVariant,
        borderLeftColor: theme.colors.primary,
        borderLeftWidth: 3,
        paddingLeft: 10,
        borderRadius: 4,
      },
      strong: { fontWeight: "bold" as const },
      em: { fontStyle: "italic" as const },
    }),
    [theme.colors, codeBlockStyle],
  );

  const textStyles = useMemo(
    () => ({
      userText: { color: theme.colors.onPrimary, fontSize: 15, lineHeight: 22 },
      timestampLeft: {
        color: theme.colors.onSurfaceVariant,
        marginTop: 2,
        marginHorizontal: 4,
      },
      timestampRight: {
        color: theme.colors.onSurfaceVariant,
        marginTop: 2,
        marginHorizontal: 4,
        textAlign: "right" as const,
      },
    }),
    [theme.colors],
  );

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = useCallback((content: string, key: string) => {
    Clipboard.setString(content);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  const mdRules = useMemo(
    () => ({
      fence: (node: any, _children: any, _parent: any, _styles: any) => {
        const lang = node.attributes.language || "code";
        const key = `fence-${node.key}`;
        return (
          <View
            style={[
              styles.codeBlockContainer,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View
              style={[
                styles.codeBlockHeader,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {lang}
              </Text>
              <TouchableRipple
                onPress={() => handleCopy(node.content, key)}
                style={styles.copyButton}
                accessibilityLabel="코드 복사"
              >
                <Icon
                  source={copiedKey === key ? "check" : "content-copy"}
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
              </TouchableRipple>
            </View>
            <Text style={styles.codeBlockText} selectable>
              {node.content}
            </Text>
          </View>
        );
      },
      code_block: (node: any, _children: any, _parent: any, _styles: any) => {
        const key = `cb-${node.key}`;
        return (
          <View
            style={[
              styles.codeBlockContainer,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View
              style={[
                styles.codeBlockHeader,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                code
              </Text>
              <TouchableRipple
                onPress={() => handleCopy(node.content, key)}
                style={styles.copyButton}
                accessibilityLabel="코드 복사"
              >
                <Icon
                  source={copiedKey === key ? "check" : "content-copy"}
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
              </TouchableRipple>
            </View>
            <Text style={styles.codeBlockText} selectable>
              {node.content}
            </Text>
          </View>
        );
      },
    }),
    [theme.colors, copiedKey, handleCopy],
  );

  const bubbleBg = isUser ? theme.colors.primary : theme.colors.surface;

  const showAvatar = !isUser && isFirstInGroup;
  const showTimestamp = isLastInGroup;

  return (
    <View
      style={[
        styles.container,
        { marginTop: isFirstInGroup ? SPACING.md : SPACING.xs },
      ]}
      accessibilityLabel={
        isUser
          ? `사용자: ${accessibilityContent}`
          : `어시스턴트: ${accessibilityContent}`
      }
      accessibilityRole="text"
    >
      {!isUser && (
        <View style={styles.assistantRow}>
          {showAvatar ? (
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon source="sparkles" size={16} color={theme.colors.primary} />
            </View>
          ) : (
            <View style={styles.avatarSpacer} />
          )}
          <View style={styles.bubbleColumn}>
            <View
              style={[
                styles.bubble,
                { backgroundColor: bubbleBg },
                SHADOWS.sm,
                isFirstInGroup && { borderTopLeftRadius: 4 },
                !isFirstInGroup && { borderTopLeftRadius: BORDER_RADIUS.lg },
                isLastInGroup && { borderBottomLeftRadius: 4 },
                !isLastInGroup && { borderBottomLeftRadius: BORDER_RADIUS.lg },
                message.isFailed && {
                  borderWidth: 1.5,
                  borderColor: theme.colors.error,
                },
              ]}
            >
              {message.isStreaming && !message.content ? (
                <TypingIndicator color={theme.colors.onSurfaceVariant} />
              ) : isUser ? (
                <Text style={textStyles.userText} selectable>
                  {message.content}
                </Text>
              ) : message.isStreaming ? (
                <Text style={mdStyles.body} selectable>
                  {message.content}
                </Text>
              ) : (
                <Markdown style={mdStyles} rules={mdRules}>
                  {message.content}
                </Markdown>
              )}
              {message.isFailed && onRetry && (
                <TouchableRipple
                  onPress={() => onRetry(message.content)}
                  style={styles.retryButton}
                  accessibilityLabel="메시지 재전송"
                >
                  <View style={styles.retryRow}>
                    <Icon
                      source="refresh"
                      size={14}
                      color={theme.colors.error}
                    />
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.error }}
                    >
                      재전송
                    </Text>
                  </View>
                </TouchableRipple>
              )}
            </View>
            {showTimestamp && (
              <Text variant="labelSmall" style={textStyles.timestampLeft}>
                {formatTimestampLabel(message)}
              </Text>
            )}
          </View>
        </View>
      )}
      {isUser && (
        <View style={styles.userColumn}>
          <View
            style={[
              styles.bubble,
              { backgroundColor: bubbleBg },
              SHADOWS.sm,
              { borderBottomRightRadius: 4 },
              !isFirstInGroup && { borderTopRightRadius: BORDER_RADIUS.lg },
              !isLastInGroup && { borderBottomRightRadius: BORDER_RADIUS.lg },
              message.isFailed && {
                borderWidth: 1.5,
                borderColor: theme.colors.error,
              },
            ]}
          >
            <Text style={textStyles.userText} selectable>
              {message.content}
            </Text>
          </View>
          {showTimestamp && (
            <Text variant="labelSmall" style={textStyles.timestampRight}>
              {formatTimestampLabel(message)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: SPACING.md },
  assistantRow: { flexDirection: "row", alignItems: "flex-start" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  avatarSpacer: { width: 32 },
  bubbleColumn: { flex: 1, marginLeft: SPACING.sm, alignItems: "flex-start" },
  userColumn: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  retryButton: { marginTop: 4, alignSelf: "flex-start", borderRadius: 8 },
  retryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  codeBlockContainer: {
    borderRadius: BORDER_RADIUS.md,
    marginVertical: SPACING.sm,
    overflow: "hidden",
  },
  codeBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 6,
  },
  codeBlockText: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 20,
    padding: SPACING.md,
    color: undefined,
  },
  copyButton: {
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});
