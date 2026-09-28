import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeModeContextValue {
	themeMode: ThemeMode;
	setThemeMode: (mode: ThemeMode) => void;
	cycleThemeMode: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function useThemeMode() {
	const ctx = useContext(ThemeModeContext);
	if (!ctx) {
		throw new Error("useThemeMode must be used within a ThemeModeProvider");
	}
	return ctx;
}
