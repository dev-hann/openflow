import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { AppNavigator } from "./navigation/index";
import { COLORS } from "./constants/theme";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <AppNavigator />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
