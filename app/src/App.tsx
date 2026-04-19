import React from "react";
import { View, StyleSheet, StatusBar, useColorScheme } from "react-native";
import { AppNavigator } from "./navigation/index";
import { useTheme } from "./constants/theme";
import { useAuthStore } from "./store/auth";
import { loadAuth } from "./services/auth";
import { useSettingsStore } from "./store/settings";

export default function App() {
  const colors = useTheme();
  const colorScheme = useColorScheme();
  const setStoredAuth = useAuthStore((s) => s.setStoredAuth);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);

  React.useEffect(() => {
    loadAuth().then((auth) => {
      if (auth) {
        setStoredAuth(auth);
        setServerUrl(auth.serverUrl);
      }
    });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <AppNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
