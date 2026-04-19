import { MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import { useColorScheme } from "react-native";

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  inputBar: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 4,
  },
} as const;

const FONTS = {
  displayLarge: { fontFamily: "System", fontSize: 57, lineHeight: 64, letterSpacing: -0.25, fontWeight: "400" as const },
  displayMedium: { fontFamily: "System", fontSize: 45, lineHeight: 52, fontWeight: "400" as const },
  displaySmall: { fontFamily: "System", fontSize: 36, lineHeight: 44, fontWeight: "400" as const },
  headlineLarge: { fontFamily: "System", fontSize: 32, lineHeight: 40, fontWeight: "400" as const },
  headlineMedium: { fontFamily: "System", fontSize: 28, lineHeight: 36, fontWeight: "400" as const },
  headlineSmall: { fontFamily: "System", fontSize: 24, lineHeight: 32, fontWeight: "400" as const },
  titleLarge: { fontFamily: "System", fontSize: 22, lineHeight: 28, fontWeight: "500" as const },
  titleMedium: { fontFamily: "System", fontSize: 16, lineHeight: 24, letterSpacing: 0.15, fontWeight: "500" as const },
  titleSmall: { fontFamily: "System", fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: "500" as const },
  bodyLarge: { fontFamily: "System", fontSize: 16, lineHeight: 24, letterSpacing: 0.5, fontWeight: "400" as const },
  bodyMedium: { fontFamily: "System", fontSize: 14, lineHeight: 20, letterSpacing: 0.25, fontWeight: "400" as const },
  bodySmall: { fontFamily: "System", fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: "400" as const },
  labelLarge: { fontFamily: "System", fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: "500" as const },
  labelMedium: { fontFamily: "System", fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontWeight: "500" as const },
  labelSmall: { fontFamily: "System", fontSize: 11, lineHeight: 16, letterSpacing: 0.5, fontWeight: "500" as const },
};

export const lightTheme = {
  ...MD3LightTheme,
  fonts: FONTS,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#4F46E5",
    primaryContainer: "#E0E7FF",
    onPrimary: "#FFFFFF",
    secondary: "#6B7280",
    secondaryContainer: "#F3F4F6",
    onSecondaryContainer: "#374151",
    tertiary: "#10B981",
    tertiaryContainer: "#D1FAE5",
    error: "#EF4444",
    errorContainer: "#FEE2E2",
    surface: "#FFFFFF",
    surfaceVariant: "#F9FAFB",
    background: "#FFFFFF",
    outline: "#E5E7EB",
    outlineVariant: "#F3F4F6",
    onSurface: "#111827",
    onSurfaceVariant: "#6B7280",
    inverseOnSurface: "#FFFFFF",
    inverseSurface: "#111827",
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  fonts: FONTS,
  roundness: 12,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#818CF8",
    primaryContainer: "#312E81",
    onPrimary: "#0F172A",
    secondary: "#94A3B8",
    secondaryContainer: "#334155",
    onSecondaryContainer: "#CBD5E1",
    tertiary: "#34D399",
    tertiaryContainer: "#064E3B",
    error: "#F87171",
    errorContainer: "#7F1D1D",
    surface: "#1E293B",
    surfaceVariant: "#334155",
    background: "#0F172A",
    outline: "#334155",
    outlineVariant: "#1E293B",
    onSurface: "#F1F5F9",
    onSurfaceVariant: "#94A3B8",
    inverseOnSurface: "#0F172A",
    inverseSurface: "#F1F5F9",
  },
};

export function useAppTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
}

export type AppTheme = typeof lightTheme;
