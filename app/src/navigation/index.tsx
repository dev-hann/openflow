import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { Text, View, StyleSheet } from "react-native";
import { ChatScreen } from "../screens/ChatScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { DrawerContent } from "../drawer/DrawerContent";
import { useTheme, SPACING, TYPOGRAPHY } from "../constants/theme";
import { useAuthStore } from "../store/auth";

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function ChatTab() {
  const colors = useTheme();
  const isConnected = useAuthStore((s) => s.isConnected);
  const storedAuth = useAuthStore((s) => s.storedAuth);

  return (
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
        name="ChatMain"
        component={ChatScreen}
        options={{
          title: "채팅",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💬</Text>,
          headerTitle: "OpenFlow",
          headerLeft: () => null,
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
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "설정",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
          headerTitle: "설정",
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const colors = useTheme();

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
      <Drawer.Navigator
        drawerContent={() => <DrawerContent />}
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            backgroundColor: colors.background,
            width: 280,
          },
          drawerType: "slide",
        }}
      >
        <Drawer.Screen name="Main" component={ChatTab} />
      </Drawer.Navigator>
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
