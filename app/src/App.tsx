import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { AppNavigator } from "./navigation/index";
import { useTheme } from "./constants/theme";
import { useAuthStore } from "./store/auth";
import { loadAuth } from "./services/auth";
import { useSettingsStore } from "./store/settings";

export default function App() {
  const colors = useTheme();
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
        barStyle={colors.background === "#FFFFFF" ? "dark-content" : "light-content"}
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
