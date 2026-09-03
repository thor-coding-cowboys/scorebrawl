import * as SecureStore from "expo-secure-store";
import { useEffect, useState, type PropsWithChildren } from "react";

import { ThemeMode, ThemeModeContext } from "@/hooks/use-theme-mode";

const STORAGE_KEY = "theme-mode";

const VALID_MODES = ["light", "dark", "system"] as const;

function isThemeMode(value: string | null): value is ThemeMode {
	return value !== null && (VALID_MODES as readonly string[]).includes(value);
}

export function ThemeProvider({ children }: PropsWithChildren) {
	const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

	useEffect(() => {
		let active = true;
		SecureStore.getItemAsync(STORAGE_KEY)
			.then((stored) => {
				if (active && isThemeMode(stored)) setThemeModeState(stored);
			})
			.catch(() => {
				// Ignore read failures; default to system.
			});
		return () => {
			active = false;
		};
	}, []);

	const setThemeMode = (mode: ThemeMode) => {
		setThemeModeState(mode);
		SecureStore.setItemAsync(STORAGE_KEY, mode).catch(() => {
			// Ignore write failures; in-memory value still applies.
		});
	};

	const cycleThemeMode = () => {
		setThemeMode(themeMode === "light" ? "dark" : themeMode === "dark" ? "system" : "light");
	};

	return (
		<ThemeModeContext.Provider value={{ themeMode, setThemeMode, cycleThemeMode }}>
			{children}
		</ThemeModeContext.Provider>
	);
}
