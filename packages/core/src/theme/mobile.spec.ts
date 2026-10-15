import { describe, expect, it } from "vitest";

import { oklchToHex } from "./oklch";
import { themes } from "./tokens";
import { mobileColorKeys, toMobileColors } from "./mobile";

describe("toMobileColors", () => {
	it("emits only hex — no oklch may reach a React Native style", () => {
		for (const mode of ["light", "dark"] as const) {
			for (const value of Object.values(toMobileColors(mode))) {
				expect(value, `${mode}: ${value}`).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
			}
		}
	});

	it("exposes the same keys for both modes", () => {
		expect(Object.keys(toMobileColors("light"))).toEqual(Object.keys(toMobileColors("dark")));
	});

	it("covers the full token tree", () => {
		const keys = mobileColorKeys();
		expect(keys).toContain("glowBlueBackground");
		expect(keys).toContain("glowAmberText");
		expect(keys).toContain("seasonStatusActiveText");
		expect(keys).toContain("scoreTypeThreeOneZeroSolid");
		expect(keys).toContain("avatar0Background");
		expect(keys).toContain("streakFire0");
		expect(keys).toContain("formDraw");
	});

	it("carries the unified form and destructive values", () => {
		expect(toMobileColors("light").formWin).toBe("#16a34a");
		expect(toMobileColors("dark").formDraw).toBe("#d97706");
		expect(toMobileColors("light").destructive).toBe(
			oklchToHex(themes.light.destructive) as string
		);
		expect(toMobileColors("dark").destructive).toBe(oklchToHex(themes.dark.destructive) as string);
	});
});
