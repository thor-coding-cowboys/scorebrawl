import { describe, expect, it } from "vitest";

import { palette } from "./palette";
import { paletteVars, themeCssVars } from "./css-vars";
import { themes } from "./tokens";

function leafCount(value: unknown): number {
	if (typeof value === "string") return 1;
	if (Array.isArray(value)) return value.reduce<number>((sum, entry) => sum + leafCount(entry), 0);
	if (value && typeof value === "object") {
		return Object.values(value).reduce<number>((sum, entry) => sum + leafCount(entry), 0);
	}
	return 0;
}

describe("themeCssVars", () => {
	it("emits a var for every leaf", () => {
		expect(Object.keys(themeCssVars("light"))).toHaveLength(leafCount(themes.light));
	});

	it("spot-checks irregular names", () => {
		const vars = themeCssVars("light");
		expect(vars["--chart-1"]).toBe(themes.light.chart1);
		expect(vars["--avatar-0-background"]).toBe(themes.light.avatar[0].background);
		expect(vars["--glow-blue-radial"]).toBe(themes.light.glow.blue.radial);
		expect(vars["--score-type-three-one-zero-text"]).toBe(themes.light.scoreType.threeOneZero.text);
		expect(vars["--season-status-active-solid"]).toBe(themes.light.seasonStatus.active.solid);
		expect(vars["--streak-fire-ramp-0"]).toBe(themes.light.streak.fire.ramp[0]);
		expect(vars["--streak-ice-ramp-2"]).toBe(themes.light.streak.ice.ramp[2]);
		expect(vars["--card-foreground"]).toBe(themes.light.cardForeground);
	});

	it("emits the same var names for both modes", () => {
		expect(Object.keys(themeCssVars("light"))).toEqual(Object.keys(themeCssVars("dark")));
	});
});

describe("paletteVars", () => {
	it("exposes every palette ramp separately", () => {
		expect(paletteVars()["--blue-500"]).toBe(palette.blue[500]);
		expect(paletteVars()["--red-950"]).toBe(palette.red[950]);
		expect(paletteVars()["--pink-600"]).toBe(palette.pink[600]);
	});
});
