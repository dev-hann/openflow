import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  type ViewStyle,
  type StyleProp,
} from "react-native";

interface KeyboardSafeViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  offset?: number;
}

export function KeyboardSafeView({
  children,
  style,
  offset,
}: KeyboardSafeViewProps) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={offset ?? (Platform.OS === "ios" ? 88 : 0)}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
