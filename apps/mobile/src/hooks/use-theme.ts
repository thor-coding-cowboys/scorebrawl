/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeMode } from "@/hooks/use-theme-mode";

/** The active colour scheme, with the user's override applied. */
export function useResolvedThemeMode(): "light" | "dark" {
	const { themeMode } = useThemeMode();
	const deviceScheme = useColorScheme();
	return themeMode === "system" ? (deviceScheme === "dark" ? "dark" : "light") : themeMode;
}

export function useTheme() {
	return Colors[useResolvedThemeMode()];
}
