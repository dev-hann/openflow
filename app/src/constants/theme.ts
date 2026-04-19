export const COLORS = {
  primary: "#4F46E5",
  primaryLight: "#818CF8",
  background: "#FFFFFF",
  surface: "#F9FAFB",
  border: "#E5E7EB",
  text: "#111827",
  textSecondary: "#6B7280",
  textInverse: "#FFFFFF",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  assistantBg: "#F3F4F6",
  userBg: "#4F46E5",
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const TYPOGRAPHY = {
  title: { fontSize: 20, fontWeight: "bold" as const },
  subtitle: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
} as const;
