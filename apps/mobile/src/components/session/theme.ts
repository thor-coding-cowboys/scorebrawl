import { useResolvedThemeMode, useTheme } from "@/hooks/use-theme";

export function useSessionTheme() {
	const theme = useTheme();
	const isDark = useResolvedThemeMode() === "dark";

	if (isDark) {
		return {
			isDark: true,
			cardBg: theme.card,
			border: "rgba(255,255,255,0.08)",
			mutedBg: "rgba(255,255,255,0.035)",
			mutedFg: "#a1a1aa",
			text: "#fafafa",
		};
	}

	return {
		isDark: false,
		cardBg: theme.card,
		border: theme.border,
		mutedBg: theme.muted,
		mutedFg: theme.mutedForeground,
		text: theme.foreground,
	};
}
