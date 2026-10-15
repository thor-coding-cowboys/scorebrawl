import { oklchToHex } from "./oklch";
import type { ThemeMode, ThemeTokens } from "./tokens";
import { themes } from "./tokens";

const capitalize = (segment: string): string => segment.charAt(0).toUpperCase() + segment.slice(1);

const join = (prefix: string, segment: string): string =>
	prefix ? `${prefix}${capitalize(segment)}` : segment;

type JoinPath<P extends string, K extends string> = P extends "" ? K : `${P}${Capitalize<K>}`;

/**
 * Every camelCase path in the token tree — the exact key set `toMobileColors`
 * emits. Narrower than `string`, so a stale `theme.someKey` fails to compile.
 */
type Paths<T, P extends string = ""> = T extends string
	? P
	: T extends readonly unknown[]
		? Paths<T[number], `${P}${number}`>
		: { [K in keyof T & string]: Paths<T[K], JoinPath<P, K>> }[keyof T & string];

export type MobileColorKey = Paths<ThemeTokens>;
export type MobileColors = Record<MobileColorKey, string>;

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
export function toMobileColors(mode: ThemeMode): MobileColors {
	const colors: Record<string, string> = {};
	flatten(themes[mode], "", colors);
	return colors as MobileColors;
}

export function mobileColorKeys(): string[] {
	return Object.keys(toMobileColors("light"));
}
