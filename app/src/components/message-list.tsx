import React, { useRef, useCallback, useMemo } from "react";
import { FlatList, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { MessageBubble } from "./MessageBubble";
import { SPACING } from "../constants/theme";
import type { ChatMessage } from "../store/chat";

const SCROLL_NEAR_BOTTOM_PX = 150;

interface GroupBoundary {
  isFirst: boolean;
  isLast: boolean;
}

interface MessageListProps {
  messages: ChatMessage[];
  onScrollStateChange?: (nearBottom: boolean) => void;
  onRetry?: (content: string) => void;
  ref?: React.Ref<FlatList>;
}

function computeGroupBoundaries(
  messages: ChatMessage[],
): Map<string, GroupBoundary> {
  const map = new Map<string, GroupBoundary>();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;
    map.set(msg.id, {
      isFirst: !prev || prev.role !== msg.role,
      isLast: !next || next.role !== msg.role,
    });
  }
  return map;
}

export const MessageList = React.forwardRef<FlatList, MessageListProps>(
  function MessageList(
    { messages, onScrollStateChange, onRetry },
    forwardedRef,
  ) {
    const theme = useTheme();
    const internalRef = useRef<FlatList>(null);
    const nearBottomRef = useRef(true);

    const boundaries = useMemo(
      () => computeGroupBoundaries(messages),
      [messages],
    );

    const scrollToBottom = useCallback(() => {
      if (nearBottomRef.current) {
        internalRef.current?.scrollToEnd({ animated: true });
      }
    }, []);

    const setRef = useCallback(
      (instance: FlatList | null) => {
        internalRef.current = instance;
        if (typeof forwardedRef === "function") {
          forwardedRef(instance);
        } else if (forwardedRef && "current" in forwardedRef) {
          (forwardedRef as React.MutableRefObject<FlatList | null>).current =
            instance;
        }
      },
      [forwardedRef],
    );

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { layoutMeasurement, contentOffset, contentSize } =
          event.nativeEvent;
        if (contentSize.height === 0) return;
        const distanceFromBottom =
          contentSize.height - contentOffset.y - layoutMeasurement.height;
        const isNearBottom = distanceFromBottom <= SCROLL_NEAR_BOTTOM_PX;
        nearBottomRef.current = isNearBottom;
        onScrollStateChange?.(!isNearBottom);
      },
      [onScrollStateChange],
    );

    const renderMessage = useCallback(
      ({ item }: { item: ChatMessage }) => {
        const bounds = boundaries.get(item.id);
        return (
          <MessageBubble
            message={item}
            isFirstInGroup={bounds?.isFirst ?? true}
            isLastInGroup={bounds?.isLast ?? true}
            onRetry={onRetry}
          />
        );
      },
      [boundaries, onRetry],
    );

    return (
      <FlatList
        ref={setRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        contentContainerStyle={[
          styles.listContent,
          { backgroundColor: theme.colors.background },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        onContentSizeChange={scrollToBottom}
        onLayout={scrollToBottom}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      />
    );
  },
);

const styles = StyleSheet.create({
  listContent: { paddingVertical: SPACING.sm, paddingBottom: SPACING.lg },
});
