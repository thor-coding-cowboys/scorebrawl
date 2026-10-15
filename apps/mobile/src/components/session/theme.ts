import { useResolvedThemeMode, useTheme } from "@/hooks/use-theme";

export function useSessionTheme() {
	const theme = useTheme();

	return {
		isDark: useResolvedThemeMode() === "dark",
		cardBg: theme.card,
		border: theme.sessionBorder,
		mutedBg: theme.sessionSurface,
		mutedFg: theme.mutedForeground,
		text: theme.foreground,
	};
}
