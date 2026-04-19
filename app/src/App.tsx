import React from "react";
import { View, StyleSheet, StatusBar, useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";
import { AppNavigator } from "./navigation/index";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { lightTheme, darkTheme } from "./constants/theme";
import { useAuthStore } from "./store/auth";
import { loadAuth } from "./services/auth";
import { useSettingsStore } from "./store/settings";

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? darkTheme : lightTheme;
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const setStoredAuth = useAuthStore((s) => s.setStoredAuth);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const [initialized, setInitialized] = React.useState(false);
  const [onboardingDone, setOnboardingDone] = React.useState(false);

  const prevAuthRef = React.useRef(storedAuth);
  React.useEffect(() => {
    if (prevAuthRef.current && !storedAuth) {
      setOnboardingDone(false);
    }
    prevAuthRef.current = storedAuth;
  }, [storedAuth]);

  React.useEffect(() => {
    loadAuth().then((auth) => {
      if (auth) {
        setStoredAuth(auth);
        setServerUrl(auth.serverUrl);
        setOnboardingDone(true);
      }
      setInitialized(true);
    });
  }, [setStoredAuth, setServerUrl]);

  const barStyle = colorScheme === "dark" ? "light-content" : "dark-content";

  let content: React.ReactNode = null;
  if (!initialized) {
    content = null;
  } else if (!onboardingDone) {
    content = <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
  } else {
    content = <AppNavigator />;
  }

  return (
    <PaperProvider theme={theme}>
      <View style={styles.container}>
        <StatusBar barStyle={barStyle} />
        {content}
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
