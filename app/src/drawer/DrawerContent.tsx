import React from "react";
import { View, StyleSheet, FlatList, Alert, Modal } from "react-native";
import { Text, List, Button, Appbar, useTheme, Divider, TouchableRipple, Icon } from "react-native-paper";
import { useSessionsStore } from "../store/sessions";
import { useApiClient } from "../hooks/use-api-client";
import type { SessionInfo } from "../types/protocol";
import { SPACING, BORDER_RADIUS } from "../constants/theme";

interface SessionModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchSession: (sessionId: string) => void;
}

export function SessionModal({ visible, onClose, onSwitchSession }: SessionModalProps) {
  const theme = useTheme();
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const addSession = useSessionsStore((s) => s.addSession);
  const removeSession = useSessionsStore((s) => s.removeSession);
  const getApi = useApiClient();

  const handleNewSession = React.useCallback(async () => {
    const client = await getApi();
    if (!client) return;
    try {
      const session = await client.api.createSession(client.token);
      const now = Date.now();
      addSession({ id: session.id, title: session.title, createdAt: now, updatedAt: now, messageCount: 0 });
      onSwitchSession(session.id);
      onClose();
    } catch {
      Alert.alert("오류", "세션 생성에 실패했습니다.");
    }
  }, [getApi, addSession, onSwitchSession, onClose]);

  const handleDelete = React.useCallback(
    (session: SessionInfo) => {
      Alert.alert("세션 삭제", `"${session.title}" 세션을 삭제하시겠습니까?`, [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: async () => {
          const client = await getApi();
          if (!client) return;
          try {
            await client.api.deleteSession(client.token, session.id);
            removeSession(session.id);
            if (activeSessionId === session.id) onSwitchSession("");
          } catch {
            Alert.alert("오류", "세션 삭제에 실패했습니다.");
          }
        }},
      ]);
    },
    [getApi, removeSession, activeSessionId, onSwitchSession],
  );

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }} mode="center-aligned">
          <Appbar.Action icon="close" onPress={onClose} />
          <Appbar.Content title="세션" titleStyle={{ fontWeight: "600" }} />
          <Button mode="text" onPress={handleNewSession} icon="plus" compact>
            새 세션
          </Button>
        </Appbar.Header>
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isActive = item.id === activeSessionId;
            return (
              <TouchableRipple
                onPress={() => { if (!isActive) onSwitchSession(item.id); onClose(); }}
                style={{ backgroundColor: isActive ? theme.colors.primaryContainer : "transparent" }}
              >
                <List.Item
                  title={item.title}
                  titleStyle={{ fontWeight: isActive ? "600" : "400" }}
                  description={`${formatTime(item.updatedAt)} · ${item.messageCount}개`}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={isActive ? "chat" : "chat-outline"}
                      color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                  )}
                  right={() => (
                    <View style={{ justifyContent: "center" }}>
                      <TouchableRipple onPress={() => handleDelete(item)} style={{ padding: SPACING.xs, borderRadius: 20 }}>
                        <Icon source="delete-outline" size={18} color={theme.colors.onSurfaceVariant} />
                      </TouchableRipple>
                    </View>
                  )}
                />
              </TouchableRipple>
            );
          }}
          ItemSeparatorComponent={() => <Divider />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon source="chat-off-outline" size={40} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: SPACING.md }}>
                세션이 없습니다
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingVertical: SPACING.sm },
  emptyContainer: { paddingVertical: SPACING.xxl, alignItems: "center" },
});
