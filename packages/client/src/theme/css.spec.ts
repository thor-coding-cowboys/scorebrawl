import { describe, expect, it } from "vitest";

import { themeCssRules, themeDeclarations } from "./css";

describe("themeCssRules", () => {
	it("declares light vars on :root and dark vars on :root.dark", () => {
		const css = themeCssRules();
		expect(css).toContain(":root{");
		expect(css).toContain(":root.dark{");
		expect(css).toContain("--background:");
		expect(css).toContain("--blue-500:");
		expect(css).toContain("--glow-blue-solid:");
		expect(css).toContain("--glow-blue-radial:");
	});

	it("emits different values for the destructive token in each mode", () => {
		expect(themeDeclarations("light")["--destructive"]).not.toBe(
			themeDeclarations("dark")["--destructive"]
		);
	});
});

describe("themeDeclarations", () => {
	it("exposes the same var names for both modes", () => {
		expect(Object.keys(themeDeclarations("light"))).toEqual(Object.keys(themeDeclarations("dark")));
	});

	it("includes every palette ramp alongside the tree", () => {
		const light = themeDeclarations("light");
		expect(light["--blue-500"]).toBeDefined();
		expect(light["--background"]).toBeDefined();
	});
});
