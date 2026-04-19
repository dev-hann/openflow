import React, { useRef, useCallback } from "react";
import { FlatList, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { MessageBubble } from "./MessageBubble";
import { SPACING } from "../constants/theme";
import type { ChatMessage } from "../store/chat";

interface MessageListProps {
  messages: ChatMessage[];
  onScrollStateChange?: (nearBottom: boolean) => void;
  onRetry?: (content: string) => void;
  ref?: React.Ref<FlatList>;
}

export const MessageList = React.forwardRef<FlatList, MessageListProps>(
  function MessageList(
    { messages, onScrollStateChange, onRetry },
    forwardedRef,
  ) {
    const theme = useTheme();
    const internalRef = useRef<FlatList>(null);
    const nearBottomRef = useRef(true);
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
        const isNearBottom = distanceFromBottom <= 150;
        nearBottomRef.current = isNearBottom;
        onScrollStateChange?.(!isNearBottom);
      },
      [onScrollStateChange],
    );

    const renderMessage = useCallback(
      ({ item, index }: { item: ChatMessage; index: number }) => {
        const prev = index > 0 ? messages[index - 1] : null;
        const next = index < messages.length - 1 ? messages[index + 1] : null;
        const isFirstInGroup = !prev || prev.role !== item.role;
        const isLastInGroup = !next || next.role !== item.role;
        return (
          <MessageBubble
            message={item}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            onRetry={onRetry}
          />
        );
      },
      [messages, onRetry],
    );

    return (
      <FlatList
        ref={setRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
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
