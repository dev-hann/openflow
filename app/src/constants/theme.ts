import { useColorScheme } from "react-native";

const lightColors = {
  primary: "#4F46E5",
  primaryLight: "#818CF8",
  background: "#FFFFFF",
  surface: "#F9FAFB",
  surfaceAlt: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  textSecondary: "#6B7280",
  textInverse: "#FFFFFF",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  assistantBg: "#F3F4F6",
  userBg: "#4F46E5",
  inputBg: "#F3F4F6",
  shadow: "rgba(0,0,0,0.05)",
  overlay: "rgba(0,0,0,0.4)",
};

const darkColors = {
  primary: "#818CF8",
  primaryLight: "#A5B4FC",
  background: "#0F172A",
  surface: "#1E293B",
  surfaceAlt: "#334155",
  border: "#334155",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  textInverse: "#0F172A",
  success: "#34D399",
  error: "#F87171",
  warning: "#FBBF24",
  assistantBg: "#1E293B",
  userBg: "#4F46E5",
  inputBg: "#1E293B",
  shadow: "rgba(0,0,0,0.3)",
  overlay: "rgba(0,0,0,0.6)",
};

export type ThemeColors = typeof lightColors;

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const TYPOGRAPHY = {
  title: { fontSize: 20, fontWeight: "bold" as const },
  subtitle: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
  micro: { fontSize: 10, fontWeight: "400" as const },
} as const;

export const ANIMATIONS = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;
