import React, { useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Alert, Modal, ActivityIndicator } from "react-native";
import { Text, List, Button, Appbar, useTheme, TouchableRipple, Icon } from "react-native-paper";
import { useSessionsStore } from "../store/sessions";
import { useApiClient } from "../hooks/use-api-client";
import type { SessionInfo } from "../types/protocol";
import { SPACING } from "../constants/theme";
import { formatRelativeTime } from "../utils/format-time";
import { buildSessionInfo } from "../utils/session";
import { ItemSeparator } from "./item-separator";

interface SessionModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchSession: (sessionId: string) => void;
}

export function SessionModal({ visible, onClose, onSwitchSession }: SessionModalProps) {
  const theme = useTheme();
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const addSession = useSessionsStore((s) => s.addSession);
  const removeSession = useSessionsStore((s) => s.removeSession);
  const getApi = useApiClient();
  const [creating, setCreating] = useState(false);

  const themedStyles = useMemo(() => ({
    modalBg: { backgroundColor: theme.colors.background },
    headerBg: { backgroundColor: theme.colors.surface },
    activeBg: { backgroundColor: theme.colors.primaryContainer },
    emptyText: { color: theme.colors.onSurfaceVariant, marginTop: SPACING.md },
  }), [theme.colors]);

  const handleNewSession = React.useCallback(async () => {
    if (creating) return;
    setCreating(true);
    const client = await getApi();
    if (!client) { setCreating(false); return; }
    try {
      const session = await client.api.createSession(client.token);
      addSession(buildSessionInfo(session));
      onSwitchSession(session.id);
      onClose();
    } catch {
      Alert.alert("오류", "세션 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }, [creating, getApi, addSession, onSwitchSession, onClose]);

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
            if (activeSessionId === session.id) {
              setActiveSessionId(null);
              onSwitchSession("");
            }
          } catch {
            Alert.alert("오류", "세션 삭제에 실패했습니다.");
          }
        }},
      ]);
    },
    [getApi, removeSession, activeSessionId, setActiveSessionId, onSwitchSession],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, themedStyles.modalBg]}>
        <Appbar.Header style={[styles.modalHeader, themedStyles.headerBg]} mode="center-aligned">
          <Appbar.Action icon="close" onPress={onClose} />
          <Appbar.Content title="세션" titleStyle={styles.modalTitle} />
          <Button mode="text" onPress={handleNewSession} icon={creating ? undefined : "plus"} compact disabled={creating}>
            {creating ? <ActivityIndicator size="small" color={theme.colors.primary} /> : "새 세션"}
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
                style={isActive ? themedStyles.activeBg : undefined}
              >
                <List.Item
                  title={item.title}
                  titleStyle={isActive ? styles.activeItemTitle : styles.inactiveItemTitle}
                  description={`${formatRelativeTime(item.updatedAt)} · ${item.messageCount}개`}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={isActive ? "chat" : "chat-outline"}
                      color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                  )}
                  right={() => (
                    <View style={styles.deleteButtonContainer}>
                       <TouchableRipple onPress={() => handleDelete(item)} style={styles.deleteButton} accessibilityLabel={`${item.title} 세션 삭제`}>
                        <Icon source="delete-outline" size={18} color={theme.colors.onSurfaceVariant} />
                      </TouchableRipple>
                    </View>
                  )}
                />
              </TouchableRipple>
            );
          }}
          ItemSeparatorComponent={ItemSeparator}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon source="chat-off-outline" size={40} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodyMedium" style={themedStyles.emptyText}>
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
  modalContainer: { flex: 1 },
  modalHeader: {},
  modalTitle: { fontWeight: "600" },
  listContent: { paddingVertical: SPACING.sm },
  emptyContainer: { paddingVertical: SPACING.xxl, alignItems: "center" },
  activeItemTitle: { fontWeight: "600" },
  inactiveItemTitle: { fontWeight: "400" },
  deleteButtonContainer: { justifyContent: "center" },
  deleteButton: { padding: SPACING.xs, borderRadius: 20 },
});
