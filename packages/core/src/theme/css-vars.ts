import { palette } from "./palette";
import type { ThemeMode } from "./tokens";
import { themes } from "./tokens";

const kebab = (segment: string): string =>
	segment
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([a-zA-Z])(\d)/g, "$1-$2")
		.toLowerCase();

function flatten(value: unknown, prefix: string, out: Record<string, string>): void {
	if (typeof value === "string") {
		out[`--${prefix}`] = value;
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((entry, index) => flatten(entry, `${prefix}-${index}`, out));
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, entry] of Object.entries(value)) {
			flatten(entry, prefix ? `${prefix}-${kebab(key)}` : kebab(key), out);
		}
	}
}

/** Every token in a mode as a `--custom-property` map. */
export function themeCssVars(mode: ThemeMode): Record<string, string> {
	const vars: Record<string, string> = {};
	flatten(themes[mode], "", vars);
	return vars;
}

/** Mode-invariant hue ramps as `--<hue>-<step>` custom properties. */
export function paletteVars(): Record<string, string> {
	const vars: Record<string, string> = {};
	for (const [hue, steps] of Object.entries(palette)) {
		for (const [step, value] of Object.entries(steps)) {
			vars[`--${kebab(hue)}-${step}`] = value;
		}
	}
	return vars;
}
