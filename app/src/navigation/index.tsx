import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { ChatScreen } from "../screens/ChatScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { COLORS, TYPOGRAPHY } from "../constants/theme";

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarStyle: {
            borderTopColor: COLORS.border,
          },
          tabBarLabelStyle: {
            ...TYPOGRAPHY.caption,
          },
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          headerTitleStyle: {
            ...TYPOGRAPHY.title,
            color: COLORS.text,
          },
        }}
      >
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            title: "채팅",
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💬</Text>,
            headerTitle: "OpenFlow",
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
    </NavigationContainer>
  );
}
