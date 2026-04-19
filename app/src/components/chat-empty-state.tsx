import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Text, Button, useTheme, Icon, Chip } from "react-native-paper";
import { SPACING, BORDER_RADIUS } from "../constants/theme";

const SUGGESTIONS = [
  "오늘 할 일 정리해줘",
  "코딩 문제 도와줘",
  "번역해줘",
  "요리 레시피 추천해줘",
  "재미있는 이야기 해줘",
  "최신 기술 트렌드 알려줘",
];

type EmptyStateVariant = "disconnected" | "connecting" | "empty";

interface ChatEmptyStateProps {
  variant: EmptyStateVariant;
  isSending: boolean;
  onSuggestion: (text: string) => void;
  onReconnect: () => void;
}

export function ChatEmptyState({
  variant,
  isSending,
  onSuggestion,
  onReconnect,
}: ChatEmptyStateProps) {
  const theme = useTheme();

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
        {variant === "disconnected" ? (
          <Icon
            source="link-variant-off"
            size={32}
            color={theme.colors.primary}
          />
        ) : variant === "connecting" ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <Icon
            source="robot-happy-outline"
            size={40}
            color={theme.colors.primary}
          />
        )}
      </View>

      {variant === "disconnected" && (
        <>
          <Text variant="titleMedium" style={styles.disconnectedTitle}>
            서버에 연결되지 않았습니다
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            설정 탭에서 서버에 연결하세요
          </Text>
        </>
      )}

      {variant === "connecting" && (
        <>
          <Text
            variant="bodyMedium"
            style={[
              styles.connectingText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            서버에 연결 중...
          </Text>
          <Button
            mode="outlined"
            onPress={onReconnect}
            style={styles.reconnectButton}
            icon="refresh"
          >
            다시 연결
          </Button>
        </>
      )}

      {variant === "empty" && (
        <>
          <Text variant="headlineSmall" style={styles.headline}>
            무엇이든 물어보세요
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            아래의 추천 질문을 선택하거나{"\n"}직접 메시지를 입력하세요
          </Text>
          <View style={styles.suggestionGrid}>
            {SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                mode="outlined"
                onPress={() => onSuggestion(s)}
                disabled={isSending}
                style={[
                  styles.suggestionChip,
                  { borderColor: theme.colors.outline },
                ]}
                textStyle={[
                  styles.suggestionChipText,
                  { color: theme.colors.onSurface },
                ]}
              >
                {s}
              </Chip>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  disconnectedTitle: { marginTop: SPACING.lg },
  subtitle: { marginTop: SPACING.xs, textAlign: "center" },
  connectingText: { marginTop: SPACING.md },
  reconnectButton: { marginTop: SPACING.md },
  headline: { marginTop: SPACING.lg, fontWeight: "600" },
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  suggestionChip: { borderRadius: BORDER_RADIUS.xl },
  suggestionChipText: { fontSize: 13 },
});
