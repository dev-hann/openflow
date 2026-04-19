import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Text, Button, Chip, useTheme } from "react-native-paper";
import { SPACING } from "../constants/theme";

interface VerifyResult {
  ok: boolean;
  models?: string[];
  error?: string;
}

interface VerifySectionProps {
  verifying: boolean;
  verifyResult: VerifyResult | null;
  selectedModel: string;
  baseUrl: string;
  onVerify: () => void;
  onSelectModel: (model: string) => void;
}

export function VerifySection({
  verifying,
  verifyResult,
  selectedModel,
  baseUrl,
  onVerify,
  onSelectModel,
}: VerifySectionProps) {
  const theme = useTheme();

  return (
    <>
      <Button
        mode="outlined"
        onPress={onVerify}
        loading={verifying}
        disabled={verifying || !baseUrl.trim()}
        icon="connection"
        style={styles.verifyButton}
      >
        연결 테스트
      </Button>
      {verifyResult && (
        <View
          style={[
            styles.verifyResult,
            {
              backgroundColor: verifyResult.ok
                ? theme.colors.tertiaryContainer
                : theme.colors.errorContainer,
            },
          ]}
        >
          <Text
            variant="labelLarge"
            style={{
              color: verifyResult.ok
                ? theme.colors.tertiary
                : theme.colors.error,
            }}
          >
            {verifyResult.ok
              ? `연결 성공 (${verifyResult.models?.length ?? 0}개 모델)`
              : `연결 실패: ${verifyResult.error}`}
          </Text>
        </View>
      )}
      {verifyResult?.ok && (verifyResult.models?.length ?? 0) > 0 && (
        <View style={styles.modelSection}>
          <Text variant="labelLarge" style={styles.modelLabel}>
            기본 모델
          </Text>
          <View style={styles.modelList}>
            {(verifyResult.models ?? []).slice(0, 10).map((m) => (
              <Chip
                key={m}
                selected={m === selectedModel}
                onPress={() => onSelectModel(m)}
                style={styles.modelChip}
                textStyle={styles.modelChipText}
                compact
              >
                {m}
              </Chip>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  verifyButton: { marginTop: SPACING.sm },
  verifyResult: { borderRadius: 8, padding: SPACING.sm, marginTop: SPACING.sm },
  modelSection: { marginTop: SPACING.md },
  modelLabel: { marginBottom: SPACING.xs },
  modelList: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  modelChip: { maxWidth: "48%" },
  modelChipText: { fontSize: 11 },
});
