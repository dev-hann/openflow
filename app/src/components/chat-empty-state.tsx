import React from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  type DimensionValue,
} from "react-native";
import {
  Text,
  Button,
  useTheme,
  Icon,
  TouchableRipple,
  Surface,
} from "react-native-paper";
import { SPACING, BORDER_RADIUS, SHADOWS } from "../constants/theme";

const SUGGESTIONS = [
  { icon: "lightbulb-outline", text: "오늘 할 일 정리해줘", label: "할 일" },
  { icon: "code-tags", text: "코드 작성 도와줘", label: "코딩" },
  { icon: "translate", text: "번역해줘", label: "번역" },
  { icon: "magnify", text: "검색해줘", label: "검색" },
  { icon: "chart-line", text: "데이터 분석해줘", label: "분석" },
  { icon: "pencil-outline", text: "글 작성해줘", label: "작성" },
] as const;

type EmptyStateVariant = "disconnected" | "connecting" | "empty";

interface ChatEmptyStateProps {
  variant: EmptyStateVariant;
  isSending: boolean;
  onSuggestion: (text: string) => void;
  onReconnect: () => void;
}

const STATUS_MESSAGES: Record<EmptyStateVariant, string> = {
  empty: "무엇이든 물어보세요",
  connecting: "연결 중...",
  disconnected: "서버에 연결해주세요",
};

export function ChatEmptyState({
  variant,
  isSending,
  onSuggestion,
  onReconnect,
}: ChatEmptyStateProps) {
  const theme = useTheme();
  const isConnected = variant === "empty";
  const showReconnect = variant === "connecting" || variant === "disconnected";

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <Icon
          source="robot-happy-outline"
          size={40}
          color={theme.colors.primary}
        />
      </View>

      <Text
        variant="headlineSmall"
        style={[styles.headline, { color: theme.colors.onSurface }]}
      >
        OpenFlow에 오신 것을{"\n"}환영합니다
      </Text>

      <Text
        variant="bodyMedium"
        style={[
          styles.statusMessage,
          {
            color: isConnected
              ? theme.colors.onSurfaceVariant
              : theme.colors.error,
          },
        ]}
      >
        {STATUS_MESSAGES[variant]}
      </Text>

      {isConnected && (
        <View style={styles.grid}>
          {SUGGESTIONS.map((s) => (
            <TouchableRipple
              key={s.label}
              onPress={() => onSuggestion(s.text)}
              disabled={isSending}
              style={styles.cardRipple}
            >
              <Surface
                style={[
                  styles.card,
                  SHADOWS.sm,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
                elevation={1}
              >
                <Icon
                  source={s.icon}
                  size={24}
                  color={theme.colors.primary}
                />
                <Text
                  variant="labelLarge"
                  style={[
                    styles.cardLabel,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {s.label}
                </Text>
              </Surface>
            </TouchableRipple>
          ))}
        </View>
      )}

      {showReconnect && (
        <Button
          mode="contained"
          onPress={onReconnect}
          style={styles.reconnectButton}
          icon="refresh"
          loading={variant === "connecting"}
        >
          {variant === "connecting" ? "연결 중..." : "재연결"}
        </Button>
      )}
    </View>
  );
}

const CARD_WIDTH: DimensionValue = "45%";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headline: {
    marginTop: SPACING.lg,
    fontWeight: "700",
    textAlign: "center",
  },
  statusMessage: {
    marginTop: SPACING.sm,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    width: "100%",
  },
  cardRipple: {
    width: CARD_WIDTH,
    borderRadius: BORDER_RADIUS.lg,
  },
  card: {
    width: "100%",
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  cardLabel: {
    marginTop: SPACING.xs,
  },
  reconnectButton: {
    marginTop: SPACING.xl,
  },
});
