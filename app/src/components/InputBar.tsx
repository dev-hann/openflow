import React, { useState, useCallback } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { TextInput, IconButton, useTheme } from "react-native-paper";
import { SPACING, SHADOWS, BORDER_RADIUS } from "../constants/theme";

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const InputBar = React.memo(function InputBar({ onSend, disabled }: InputBarProps) {
  const theme = useTheme();
  const [text, setText] = useState("");

  const handleSend = useCallback((): void => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }, [text, disabled, onSend]);

  const handleChangeText = useCallback((newText: string): void => {
    if (Platform.OS === "android" && newText.includes("\n")) {
      const withoutNewline = newText.replace(/\n/g, "");
      const trimmed = withoutNewline.trim();
      if (trimmed && !disabled) {
        onSend(trimmed);
        setText("");
        return;
      }
    }
    setText(newText);
  }, [disabled, onSend]);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }, SHADOWS.inputBar]}>
      <View style={[styles.inputWrapper, { backgroundColor: theme.colors.surfaceVariant }]}>
        <TextInput
          mode="flat"
          value={text}
          onChangeText={handleChangeText}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
          multiline
          maxLength={4000}
          editable={!disabled}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={Platform.OS === "ios"}
          dense
          style={[styles.input, { color: theme.colors.onSurface }]}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          textColor={theme.colors.onSurface}
        />
      </View>
      <IconButton
        icon="send"
        size={20}
        onPress={handleSend}
        disabled={!canSend}
        iconColor={canSend ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
        containerColor={canSend ? theme.colors.primary : "transparent"}
        style={[styles.sendButton, canSend && { ...SHADOWS.sm }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  inputWrapper: {
    flex: 1,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
  },
  input: {
    minHeight: 40,
    maxHeight: 120,
    borderRadius: BORDER_RADIUS.xl,
    fontSize: 15,
    paddingHorizontal: SPACING.md,
    backgroundColor: "transparent",
  },
  sendButton: {
    margin: 0,
    marginLeft: SPACING.xs,
    marginBottom: 2,
    borderRadius: 20,
  },
});
