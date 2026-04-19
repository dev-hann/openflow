import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "OpenFlow",
  slug: "openflow",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "openflow",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#4F46E5",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.openflow.app",
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryConnections: true,
      },
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#4F46E5",
    },
    package: "com.openflow.app",
    allowBackup: true,
    softwareKeyboardLayoutMode: "resize",
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png",
  },
  plugins: ["expo-router"],
  extra: {
    eas: {
      projectId: "97c51cc0-050c-4ca7-b6ee-5c9158cc7b7a",
    },
  },
};

export default config;
