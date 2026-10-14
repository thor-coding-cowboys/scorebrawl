import { oklchToHex, themes } from "@coding-cowboys/scorebrawl-core/theme";
import type { CSSProperties } from "react";

const hex = (value: string): string => oklchToHex(value) ?? "currentColor";

/**
 * Mode-invariant families, resolved to hex once. Hex works both as a CSS
 * property and as an SVG attribute, which `var()` does not.
 */

/** Unified W/D/L colours. */
export const formColors = {
	W: hex(themes.light.form.win),
	D: hex(themes.light.form.draw),
	L: hex(themes.light.form.loss),
} as const;

export type FormResult = keyof typeof formColors;

/** Background (and optional halo) for a form dot. */
export function formDotStyle(result: FormResult, glow = false): CSSProperties {
	const color = formColors[result];
	return {
		backgroundColor: color,
		...(glow ? { boxShadow: `0 0 8px color-mix(in oklab, ${color} 60%, transparent)` } : {}),
	};
}

/** Line colours for player comparison charts. */
export const chartSeries = {
	a: hex(themes.light.chartSeries.a),
	b: hex(themes.light.chartSeries.b),
} as const;

/** Achievement confetti. */
export const confettiColors: string[] = themes.light.confetti.map(hex);
