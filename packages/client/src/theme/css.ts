import { paletteVars, themeCssVars } from "@coding-cowboys/scorebrawl-core/theme";
import type { ThemeMode } from "@coding-cowboys/scorebrawl-core/theme";

/** Every custom property a mode needs: the shared tree plus the palette ramps. */
export function themeDeclarations(mode: ThemeMode): Record<string, string> {
	return { ...paletteVars(), ...themeCssVars(mode) };
}

function serialize(declarations: Record<string, string>): string {
	return Object.entries(declarations)
		.map(([property, value]) => `${property}:${value};`)
		.join("");
}

/** `:root{…}:root.dark{…}` — dark switching is handled by the class on `<html>`. */
export function themeCssRules(): string {
	return `:root{${serialize(themeDeclarations("light"))}}:root.dark{${serialize(
		themeDeclarations("dark")
	)}}`;
}
