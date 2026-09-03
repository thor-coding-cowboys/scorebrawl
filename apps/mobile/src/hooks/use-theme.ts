/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeMode } from "@/hooks/use-theme-mode";

export function useTheme() {
	const { themeMode } = useThemeMode();
	const deviceScheme = useColorScheme();
	const resolved =
		themeMode === "system" ? (deviceScheme === "dark" ? "dark" : "light") : themeMode;

	return Colors[resolved];
}
