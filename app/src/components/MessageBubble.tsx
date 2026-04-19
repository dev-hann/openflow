import React, { useRef, useCallback, useEffect, useMemo } from "react";
import { View, StyleSheet, FlatList, Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Text, useTheme, Icon, TouchableRipple } from "react-native-paper";
import Markdown from "react-native-markdown-display";
import { SPACING, SHADOWS, BORDER_RADIUS } from "../constants/theme";
import type { ChatMessage } from "../store/chat";
import { formatTime } from "../utils/format-time";

function TypingIndicator({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true, easing: Easing.ease }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.ease }),
        ]),
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  const opacity = (dot: Animated.Value) => dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <View style={styles.typingDots}>
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: opacity(dot1) }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: opacity(dot2) }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: opacity(dot3) }]} />
    </View>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onRetry?: (content: string) => void;
}

export const MessageBubble = React.memo(function MessageBubble({ message, isFirstInGroup, isLastInGroup, onRetry }: MessageBubbleProps) {
  const theme = useTheme();
  const isUser = message.role === "user";

  const mdStyles = useMemo(() => ({
    body: { color: theme.colors.onSurface, fontSize: 15, lineHeight: 22 },
    paragraph: { margin: 0, marginBottom: 6 },
    heading1: { color: theme.colors.onSurface, fontSize: 20, fontWeight: "bold" as const, marginTop: 8, marginBottom: 4 },
    heading2: { color: theme.colors.onSurface, fontSize: 17, fontWeight: "bold" as const, marginTop: 6, marginBottom: 3 },
    heading3: { color: theme.colors.onSurface, fontSize: 15, fontWeight: "bold" as const, marginTop: 4, marginBottom: 2 },
    code_inline: { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface, fontSize: 13, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    code_block: { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface, borderRadius: 8, padding: 12, fontSize: 13 },
    fence: { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface, borderRadius: 8, padding: 12, fontSize: 13 },
    bullet_list: { marginVertical: 2 },
    ordered_list: { marginVertical: 2 },
    blockquote: { backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.primary, borderLeftWidth: 3, paddingLeft: 10, borderRadius: 4 },
    strong: { fontWeight: "bold" as const },
    em: { fontStyle: "italic" as const },
  }), [theme.colors]);

  const textStyles = useMemo(() => ({
    userText: { color: theme.colors.onPrimary, fontSize: 15, lineHeight: 22 },
    timestampLeft: { color: theme.colors.onSurfaceVariant, marginTop: 2, marginHorizontal: 4 },
    timestampRight: { color: theme.colors.onSurfaceVariant, marginTop: 2, marginHorizontal: 4, textAlign: "right" as const },
  }), [theme.colors]);

  const bubbleBg = isUser ? theme.colors.primary : theme.colors.surface;

  const showAvatar = !isUser && isFirstInGroup;
  const showTimestamp = isLastInGroup;

  return (
    <View
      style={[
        styles.container,
        { marginTop: isFirstInGroup ? SPACING.md : SPACING.xs },
      ]}
      accessibilityLabel={isUser ? `사용자: ${message.content}` : `어시스턴트: ${message.content}`}
      accessibilityRole="text"
    >
      {!isUser && (
        <View style={styles.assistantRow}>
          {showAvatar ? (
            <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source="sparkles" size={14} color={theme.colors.primary} />
            </View>
          ) : (
            <View style={styles.avatarSpacer} />
          )}
          <View style={styles.bubbleColumn}>
            <View
              style={[
                styles.bubble,
                { backgroundColor: bubbleBg, ...SHADOWS.sm },
                isUser && { borderBottomRightRadius: 4 },
                !isUser && isFirstInGroup && { borderTopLeftRadius: 4 },
                !isUser && !isFirstInGroup && { borderTopLeftRadius: BORDER_RADIUS.lg },
                !isUser && isLastInGroup && { borderBottomLeftRadius: 4 },
                !isUser && !isLastInGroup && { borderBottomLeftRadius: BORDER_RADIUS.lg },
                message.isFailed && { borderWidth: 1.5, borderColor: theme.colors.error },
              ]}
            >
              {message.isStreaming && !message.content ? (
                <TypingIndicator color={theme.colors.onSurfaceVariant} />
              ) : isUser ? (
                <Text style={textStyles.userText} selectable>{message.content}</Text>
              ) : (
                <Markdown style={mdStyles}>{message.content}</Markdown>
              )}
              {message.isFailed && onRetry && (
                <TouchableRipple onPress={() => onRetry(message.content)} style={styles.retryButton} accessibilityLabel="메시지 재전송">
                  <View style={styles.retryRow}>
                    <Icon source="refresh" size={14} color={theme.colors.error} />
                    <Text variant="labelSmall" style={{ color: theme.colors.error }}>재전송</Text>
                  </View>
                </TouchableRipple>
              )}
            </View>
            {showTimestamp && (
              <Text variant="labelSmall" style={textStyles.timestampLeft}>
                {message.isFailed ? "전송 실패" : formatTime(message.timestamp)}
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
              { backgroundColor: bubbleBg, ...SHADOWS.sm },
              { borderBottomRightRadius: 4 },
              !isFirstInGroup && { borderTopRightRadius: BORDER_RADIUS.lg },
              !isLastInGroup && { borderBottomRightRadius: BORDER_RADIUS.lg },
              message.isFailed && { borderWidth: 1.5, borderColor: theme.colors.error },
            ]}
          >
            <Text style={textStyles.userText} selectable>{message.content}</Text>
          </View>
          {showTimestamp && (
            <Text variant="labelSmall" style={textStyles.timestampRight}>
              {message.isFailed ? "전송 실패" : formatTime(message.timestamp)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

interface MessageListProps {
  messages: ChatMessage[];
  onScrollStateChange?: (nearBottom: boolean) => void;
  onRetry?: (content: string) => void;
  ref?: React.Ref<FlatList>;
}

export const MessageList = React.forwardRef<FlatList, MessageListProps>(function MessageList({ messages, onScrollStateChange, onRetry }, forwardedRef) {
  const theme = useTheme();
  const internalRef = useRef<FlatList>(null);
  const nearBottomRef = useRef(true);
  const scrollToBottom = useCallback(() => {
    if (nearBottomRef.current) {
      internalRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

  const setRef = useCallback((instance: FlatList | null) => {
    internalRef.current = instance;
    if (typeof forwardedRef === "function") {
      forwardedRef(instance);
    } else if (forwardedRef && "current" in forwardedRef) {
      (forwardedRef as React.MutableRefObject<FlatList | null>).current = instance;
    }
  }, [forwardedRef]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (contentSize.height === 0) return;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    const isNearBottom = distanceFromBottom <= 150;
    nearBottomRef.current = isNearBottom;
    onScrollStateChange?.(!isNearBottom);
  }, [onScrollStateChange]);

  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const prev = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;
    const isFirstInGroup = !prev || prev.role !== item.role;
    const isLastInGroup = !next || next.role !== item.role;
    return <MessageBubble message={item} isFirstInGroup={isFirstInGroup} isLastInGroup={isLastInGroup} onRetry={onRetry} />;
  }, [messages, onRetry]);

  return (
    <FlatList
      ref={setRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={renderMessage}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      contentContainerStyle={[styles.listContent, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="interactive"
      onContentSizeChange={scrollToBottom}
      onLayout={scrollToBottom}
      onScroll={handleScroll}
      scrollEventThrottle={200}
    />
  );
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: SPACING.md },
  assistantRow: { flexDirection: "row", alignItems: "flex-start" },
  avatar: { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", marginTop: 2 },
  avatarSpacer: { width: 26 },
  bubbleColumn: { flex: 1, marginLeft: SPACING.sm, alignItems: "flex-start" },
  userColumn: { alignItems: "flex-end" },
  bubble: { maxWidth: "90%", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
  typingDots: { flexDirection: "row", gap: 4, paddingVertical: 4, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  retryButton: { marginTop: 4, alignSelf: "flex-start", borderRadius: 8 },
  retryRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  listContent: { paddingVertical: SPACING.sm, paddingBottom: SPACING.lg },
});
