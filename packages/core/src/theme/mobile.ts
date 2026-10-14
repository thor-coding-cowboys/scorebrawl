import { oklchToHex } from "./oklch";
import type { ThemeMode } from "./tokens";
import { themes } from "./tokens";

const capitalize = (segment: string): string => segment.charAt(0).toUpperCase() + segment.slice(1);

const join = (prefix: string, segment: string): string =>
	prefix ? `${prefix}${capitalize(segment)}` : segment;

function flatten(value: unknown, prefix: string, out: Record<string, string>): void {
	if (typeof value === "string") {
		const hex = oklchToHex(value);
		if (hex === null) {
			throw new Error(`Theme token is not convertible to hex: ${value}`);
		}
		out[prefix] = hex;
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((entry, index) => flatten(entry, join(prefix, String(index)), out));
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, entry] of Object.entries(value)) {
			flatten(entry, join(prefix, key), out);
		}
	}
}

/**
 * The shared tree as flat hex values with camelCase keys — the shape
 * `useTheme()` exposes on mobile. React Native cannot parse oklch, so every
 * value is converted here, once.
 */
export function toMobileColors(mode: ThemeMode): Record<string, string> {
	const colors: Record<string, string> = {};
	flatten(themes[mode], "", colors);
	return colors;
}

export function mobileColorKeys(): string[] {
	return Object.keys(toMobileColors("light"));
}
