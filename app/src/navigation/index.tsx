import React, { useMemo, useState, useCallback } from "react";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import { ChatScreen } from "../screens/ChatScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import {
  ProviderEditScreen,
  type SettingsStackParamList,
} from "../screens/ProviderEditScreen";
import { AppDrawer, useDrawerSwipe } from "../components/app-drawer";
import { SPACING } from "../constants/theme";
import { useAuthStore } from "../store/auth";
import { useSessionsStore } from "../store/sessions";

type RootStackParamList = {
  Main: undefined;
} & SettingsStackParamList;

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isConnected = useAuthStore((s) => s.isConnected);
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const sessions = useSessionsStore((s) => s.sessions);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );
  const sessionTitle = activeSession?.title ?? "새 대화";

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const { openResponder, closeResponder } = useDrawerSwipe(
    drawerOpen,
    openDrawer,
    closeDrawer,
  );

  const handleSettings = useCallback(() => {
    setDrawerOpen(false);
    navigation.navigate("SettingsMain");
  }, [navigation]);

  return (
    <View style={styles.mainContainer} {...openResponder.panHandlers}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.outline,
          },
        ]}
      >
        <TouchableOpacity
          onPress={openDrawer}
          style={styles.headerBtn}
          activeOpacity={0.6}
          accessibilityLabel="메뉴 열기"
          accessibilityRole="button"
        >
          <Icon source="menu" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <Text
          variant="titleMedium"
          numberOfLines={1}
          style={[styles.headerTitle, { color: theme.colors.onSurface }]}
        >
          {sessionTitle}
        </Text>
        {storedAuth ? (
          <View style={styles.headerBtn}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isConnected
                    ? theme.colors.tertiary
                    : theme.colors.error,
                },
              ]}
            />
          </View>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>
      <View style={styles.screenContainer}>
        <ChatScreen />
      </View>
      <View {...closeResponder.panHandlers} style={styles.swipeArea} />
      <AppDrawer
        visible={drawerOpen}
        onClose={closeDrawer}
        onSettings={handleSettings}
      />
    </View>
  );
}

export function AppNavigator() {
  const theme = useTheme();

  const navTheme = useMemo(
    () => ({
      dark: theme.dark,
      colors: {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.onSurface,
        border: theme.colors.outline,
        notification: theme.colors.error,
      },
      fonts: {
        regular: { fontFamily: "System", fontWeight: "400" as const },
        medium: { fontFamily: "System", fontWeight: "500" as const },
        bold: { fontFamily: "System", fontWeight: "700" as const },
        heavy: { fontFamily: "System", fontWeight: "900" as const },
      },
    }),
    [theme],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: theme.colors.primary,
          headerStyle: { backgroundColor: theme.colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: "bold",
            color: theme.colors.onSurface,
          },
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SettingsMain"
          component={SettingsScreen}
          options={{ title: "설정" }}
        />
        <Stack.Screen
          name="ProviderEdit"
          component={ProviderEditScreen}
          options={{ title: "Provider" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontWeight: "600",
    textAlign: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  screenContainer: {
    flex: 1,
  },
  swipeArea: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
  },
});
