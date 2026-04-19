import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View, StyleSheet } from "react-native";
import { ChatScreen } from "../screens/ChatScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useTheme, SPACING, TYPOGRAPHY } from "../constants/theme";
import { useAuthStore } from "../store/auth";

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  const colors = useTheme();
  const isConnected = useAuthStore((s) => s.isConnected);
  const storedAuth = useAuthStore((s) => s.storedAuth);

  return (
    <NavigationContainer
      theme={{
        dark: colors.background !== "#FFFFFF",
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.background,
          text: colors.text,
          border: colors.border,
          notification: colors.error,
        },
        fonts: {
          regular: { fontFamily: "System", fontWeight: "400" as const },
          medium: { fontFamily: "System", fontWeight: "500" as const },
          bold: { fontFamily: "System", fontWeight: "700" as const },
          heavy: { fontFamily: "System", fontWeight: "900" as const },
        },
      }}
    >
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
          tabBarLabelStyle: TYPOGRAPHY.micro,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            ...TYPOGRAPHY.title,
            color: colors.text,
          },
          headerShadowVisible: false,
        }}
      >
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            title: "채팅",
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💬</Text>,
            headerTitle: "OpenFlow",
            headerRight: () => {
              if (!storedAuth) return null;
              return (
                <View style={styles.headerRight}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isConnected ? colors.success : colors.error },
                    ]}
                  />
                </View>
              );
            },
          }}
        />
        <Tab.Screen
          name="Sessions"
          component={SettingsScreen}
          options={{
            title: "설정",
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
            headerTitle: "설정",
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    marginRight: SPACING.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
