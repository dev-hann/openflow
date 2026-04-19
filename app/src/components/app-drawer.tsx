import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import {
  Text,
  Button,
  useTheme,
  TouchableRipple,
  Icon,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessionsStore } from "../store/sessions";
import { useChatStore } from "../store/chat";
import { useApiClient } from "../hooks/use-api-client";
import type { SessionInfo } from "../types/protocol";
import { SPACING, BORDER_RADIUS, SHADOWS } from "../constants/theme";
import { formatRelativeTime } from "../utils/format-time";
import { buildSessionInfo } from "../utils/session";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 360);

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSettings: () => void;
}

export function AppDrawer({
  visible,
  onClose,
  onSettings,
}: AppDrawerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const addSession = useSessionsStore((s) => s.addSession);
  const removeSession = useSessionsStore((s) => s.removeSession);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const getApi = useApiClient();
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const prevVisibleRef = useRef(visible);

  React.useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          overshootClamping: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!visible && prevVisibleRef.current) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          useNativeDriver: true,
          overshootClamping: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevVisibleRef.current = visible;
  }, [visible, slideAnim, overlayAnim]);

  const handleNewSession = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    const client = await getApi();
    if (!client) {
      creatingRef.current = false;
      setCreating(false);
      return;
    }
    try {
      const session = await client.api.createSession(client.token);
      addSession(buildSessionInfo(session));
      clearMessages();
      setActiveSessionId(session.id);
      onClose();
    } catch {
      Alert.alert("오류", "세션 생성에 실패했습니다.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [getApi, addSession, clearMessages, setActiveSessionId, onClose]);

  const handleDelete = useCallback(
    (session: SessionInfo) => {
      Alert.alert("세션 삭제", `"${session.title}" 세션을 삭제하시겠습니까?`, [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            const client = await getApi();
            if (!client) return;
            try {
              await client.api.deleteSession(client.token, session.id);
              removeSession(session.id);
              if (activeSessionId === session.id) {
                setActiveSessionId(null);
                clearMessages();
              }
            } catch {
              Alert.alert("오류", "세션 삭제에 실패했습니다.");
            }
          },
        },
      ]);
    },
    [getApi, removeSession, activeSessionId, setActiveSessionId, clearMessages],
  );

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) {
        onClose();
        return;
      }
      clearMessages();
      setActiveSessionId(sessionId);
      onClose();
    },
    [activeSessionId, clearMessages, setActiveSessionId, onClose],
  );

  const renderSessionItem = useCallback(
    ({ item }: { item: SessionInfo }) => {
      const isActive = item.id === activeSessionId;
      return (
        <TouchableRipple
          onPress={() => handleSelectSession(item.id)}
          onLongPress={() => handleDelete(item)}
          style={
            isActive
              ? { backgroundColor: theme.colors.primaryContainer }
              : undefined
          }
        >
          <View style={styles.sessionItem}>
            <Icon
              source={isActive ? "chat" : "chat-outline"}
              size={20}
              color={
                isActive
                  ? theme.colors.primary
                  : theme.colors.onSurfaceVariant
              }
            />
            <View style={styles.sessionText}>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={{
                  fontWeight: isActive ? "600" : "400",
                  color: isActive
                    ? theme.colors.primary
                    : theme.colors.onSurface,
                }}
              >
                {item.title}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {formatRelativeTime(item.updatedAt)} · {item.messageCount}개
              </Text>
            </View>
            <TouchableRipple
              onPress={() => handleDelete(item)}
              style={styles.deleteBtn}
              accessibilityLabel={`${item.title} 세션 삭제`}
            >
              <Icon
                source="delete-outline"
                size={16}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableRipple>
          </View>
        </TouchableRipple>
      );
    },
    [activeSessionId, handleSelectSession, theme, handleDelete],
  );

  const themedStyles = useMemo(
    () => ({
      drawerBg: { backgroundColor: theme.colors.surface },
      overlay: { backgroundColor: "rgba(0,0,0,0.45)" },
      sectionLabel: { color: theme.colors.onSurfaceVariant },
      emptyText: { color: theme.colors.onSurfaceVariant },
      headerBorder: { backgroundColor: theme.colors.outline },
    }),
    [theme.colors],
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          themedStyles.overlay,
          { opacity: overlayAnim },
        ]}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          themedStyles.drawerBg,
          SHADOWS.lg,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <View
          style={[
            styles.drawerHeader,
            { paddingTop: insets.top || SPACING.md },
          ]}
        >
          <View style={styles.headerContent}>
            <Icon
              source="robot-outline"
              size={28}
              color={theme.colors.primary}
            />
            <Text
              variant="titleLarge"
              style={{ fontWeight: "700", color: theme.colors.onSurface }}
            >
              OpenFlow
            </Text>
          </View>
          <View style={styles.headerBorder} />
        </View>

        <View style={styles.newSessionBtn}>
          <Button
            mode="contained"
            onPress={handleNewSession}
            icon={creating ? undefined : "plus"}
            disabled={creating}
            contentStyle={styles.newSessionContent}
            style={{ borderRadius: BORDER_RADIUS.md }}
          >
            {creating ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.onPrimary}
              />
            ) : (
              "새 대화"
            )}
          </Button>
        </View>

        <Text
          variant="labelMedium"
          style={[styles.sectionLabel, themedStyles.sectionLabel]}
        >
          대화 목록
        </Text>

        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderSessionItem}
          contentContainerStyle={
            sessions.length === 0 ? styles.emptyList : styles.sessionList
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon
                source="chat-off-outline"
                size={36}
                color={theme.colors.onSurfaceVariant}
              />
              <Text variant="bodySmall" style={themedStyles.emptyText}>
                세션이 없습니다
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.drawerFooter,
            { paddingBottom: insets.bottom || SPACING.md },
          ]}
        >
          <View
            style={[styles.footerBorder, themedStyles.headerBorder]}
          />
          <TouchableRipple onPress={onSettings} style={styles.settingsBtn}>
            <View style={styles.settingsContent}>
              <Icon
                source="cog-outline"
                size={22}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginLeft: SPACING.sm,
                }}
              >
                설정
              </Text>
            </View>
          </TouchableRipple>
        </View>
      </Animated.View>
    </View>
  );
}

const SWIPE_OPEN_THRESHOLD = 60;
const SWIPE_CLOSE_THRESHOLD = -50;

export function useDrawerSwipe(
  visible: boolean,
  onOpen: () => void,
  onClose: () => void,
) {
  const openResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) =>
        e.nativeEvent.pageX < 20 && !visible,
      onMoveShouldSetPanResponder: (e, gs) =>
        e.nativeEvent.pageX < SWIPE_OPEN_THRESHOLD &&
        gs.dx > 15 &&
        !visible,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 50 && !visible) {
          onOpen();
        }
      },
    }),
  ).current;

  const closeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => visible,
      onMoveShouldSetPanResponder: (_, gs) => visible && gs.dx < -15,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < SWIPE_CLOSE_THRESHOLD && visible) {
          onClose();
        }
      },
    }),
  ).current;

  return { openResponder, closeResponder };
}

const styles = StyleSheet.create({
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
  },
  drawerHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  headerBorder: {
    height: StyleSheet.hairlineWidth,
  },
  newSessionBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  newSessionContent: {
    paddingVertical: SPACING.xs,
  },
  sectionLabel: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  sessionList: {
    paddingVertical: SPACING.xs,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.xs,
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sessionText: {
    flex: 1,
    gap: 2,
  },
  deleteBtn: {
    padding: SPACING.xs,
    borderRadius: 20,
  },
  drawerFooter: {
    paddingHorizontal: SPACING.md,
  },
  footerBorder: {
    height: StyleSheet.hairlineWidth,
    marginBottom: SPACING.xs,
  },
  settingsBtn: {
    borderRadius: BORDER_RADIUS.md,
  },
  settingsContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
});
