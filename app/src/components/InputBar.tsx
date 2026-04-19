import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from "react-native";
import { useTheme, SPACING } from "../constants/theme";

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const colors = useTheme();
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  function handleSend(): void {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  function handleSubmit(e: NativeSyntheticEvent<TextInputSubmitEditingEventData>): void {
    handleSend();
  }

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
        value={text}
        onChangeText={setText}
        placeholder="메시지를 입력하세요..."
        placeholderTextColor={colors.textSecondary}
        multiline
        maxLength={4000}
        editable={!disabled}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        blurOnSubmit={false}
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          {
            backgroundColor: canSend ? colors.primary : colors.surfaceAlt,
          },
        ]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.7}
      >
        {disabled ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : (
          <Text style={[styles.sendButtonText, { color: canSend ? colors.textInverse : colors.textSecondary }]}>
            전송
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    fontSize: 15,
    ...Platform.select({
      ios: { paddingTop: 10 },
      android: { paddingTop: 6 },
    }),
  },
  sendButton: {
    marginLeft: SPACING.sm,
    paddingHorizontal: SPACING.md + 4,
    paddingVertical: SPACING.sm + 2,
    borderRadius: 20,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    fontWeight: "600",
    fontSize: 14,
  },
});
