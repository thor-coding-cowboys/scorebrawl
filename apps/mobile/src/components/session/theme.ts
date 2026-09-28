import { Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function useSessionTheme() {
	const theme = useTheme();
	const isDark = theme.background === Colors.dark.background;

	if (isDark) {
		return {
			isDark: true,
			cardBg: "#18181b",
			border: "rgba(255,255,255,0.08)",
			mutedBg: "rgba(255,255,255,0.05)",
			mutedFg: "#a1a1aa",
			text: "#fafafa",
		};
	}

	return {
		isDark: false,
		cardBg: Colors.light.card,
		border: Colors.light.border,
		mutedBg: Colors.light.backgroundElement,
		mutedFg: Colors.light.mutedForeground,
		text: Colors.light.text,
	};
}
