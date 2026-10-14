import { describe, expect, it } from "vitest";

import { glowIntensity, themes } from "./tokens";
import type { GlowTone } from "./tokens";
import { withAlpha } from "./oklch";

function leafPaths(value: unknown, prefix = ""): string[] {
	if (typeof value === "string") return [prefix];
	if (Array.isArray(value)) {
		return value.flatMap((entry, index) => leafPaths(entry, `${prefix}[${index}]`));
	}
	if (value && typeof value === "object") {
		return Object.entries(value).flatMap(([key, entry]) =>
			leafPaths(entry, prefix ? `${prefix}.${key}` : key)
		);
	}
	return [];
}

function leafValues(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap(leafValues);
	if (value && typeof value === "object") {
		return Object.values(value).flatMap(leafValues);
	}
	return [];
}

describe("themes", () => {
	it("has identical key paths in light and dark", () => {
		expect(leafPaths(themes.light)).toEqual(leafPaths(themes.dark));
	});

	it("authors every token in oklch", () => {
		for (const [mode, tokens] of Object.entries(themes)) {
			for (const value of leafValues(tokens)) {
				expect(value, `${mode}: ${value}`).toMatch(/^oklch\(/);
			}
		}
	});

	it("uses a mode-invariant radial glow at glowIntensity", () => {
		for (const tone of Object.keys(themes.light.glow) as GlowTone[]) {
			expect(themes.light.glow[tone].radial).toBe(themes.dark.glow[tone].radial);
			expect(themes.light.glow[tone].radial).toMatch(/\/ 10%\)$/);
		}
		expect(themes.light.glow.blue.radial).toBe(
			withAlpha(themes.light.glow.blue.solid, glowIntensity)
		);
	});

	it("carries the unified destructive values", () => {
		expect(themes.light.destructive).toBe("oklch(0.577 0.245 27.325)");
		expect(themes.dark.destructive).toBe("oklch(0.704 0.191 22.216)");
	});

	it("exposes twelve avatar tones", () => {
		expect(themes.light.avatar).toHaveLength(12);
	});
});
