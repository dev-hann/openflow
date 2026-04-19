import React, { useMemo } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, StyleSheet } from "react-native";
import { Icon, useTheme } from "react-native-paper";
import { ChatScreen } from "../screens/ChatScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ProviderEditScreen, type SettingsStackParamList } from "../screens/ProviderEditScreen";
import { SPACING } from "../constants/theme";
import { useAuthStore } from "../store/auth";

const Tab = createBottomTabNavigator();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

function SettingsNavigator() {
  const theme = useTheme();
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.primary,
      }}
    >
      <SettingsStack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: "설정" }}
      />
      <SettingsStack.Screen
        name="ProviderEdit"
        component={ProviderEditScreen}
        options={{ title: "Provider" }}
      />
    </SettingsStack.Navigator>
  );
}

export function AppNavigator() {
  const theme = useTheme();
  const isConnected = useAuthStore((s) => s.isConnected);
  const storedAuth = useAuthStore((s) => s.storedAuth);

  const navTheme = useMemo(() => ({
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
  }), [theme]);

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarStyle: {
            borderTopColor: theme.colors.outline,
            backgroundColor: theme.colors.surface,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTitleStyle: { fontSize: 20, fontWeight: "bold", color: theme.colors.onSurface },
          headerShadowVisible: false,
        }}
      >
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            title: "채팅",
            tabBarIcon: ({ color, size }) => (
              <Icon source="chat-outline" size={size} color={color} />
            ),
            headerTitle: "OpenFlow",
            headerRight: () => {
              if (!storedAuth) return null;
              return (
                <View style={styles.headerRight}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isConnected ? theme.colors.tertiary : theme.colors.error },
                    ]}
                  />
                </View>
              );
            },
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsNavigator}
          options={{
            title: "설정",
            tabBarIcon: ({ color, size }) => (
              <Icon source="cog-outline" size={size} color={color} />
            ),
            headerShown: false,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerRight: { marginRight: SPACING.md },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
