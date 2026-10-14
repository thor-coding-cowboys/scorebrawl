import { describe, expect, it } from "vitest";

import { oklchToHex, withAlpha } from "./oklch";

function channels(hex: string): number[] {
	const digits = hex.slice(1, 7);
	return [0, 2, 4].map((i) => Number.parseInt(digits.slice(i, i + 2), 16));
}

describe("oklchToHex", () => {
	it("converts white and black", () => {
		expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
		expect(oklchToHex("oklch(0 0 0)")).toBe("#000000");
	});

	it("converts a chromatic value to the documented hex within rounding", () => {
		const hex = oklchToHex("oklch(0.577 0.245 27.325)");
		expect(hex).not.toBeNull();
		const expected = channels("#e7000b");
		const actual = channels(hex as string);
		actual.forEach((channel, i) => {
			expect(Math.abs(channel - (expected[i] as number))).toBeLessThanOrEqual(2);
		});
	});

	it("carries alpha into an 8-digit hex", () => {
		expect(oklchToHex("oklch(1 0 0 / 10%)")).toBe("#ffffff1a");
	});

	it("clamps out-of-gamut channels instead of emitting NaN", () => {
		expect(oklchToHex("oklch(0.7 0.4 30)")).toMatch(/^#[0-9a-f]{6}$/);
	});

	it("returns null for unparseable input", () => {
		expect(oklchToHex("#fff")).toBeNull();
		expect(oklchToHex("rgb(1,2,3)")).toBeNull();
		expect(oklchToHex("oklch(1 0)")).toBeNull();
	});
});

describe("withAlpha", () => {
	it("appends a percentage alpha", () => {
		expect(withAlpha("oklch(0.5 0.1 200)", 0.1)).toBe("oklch(0.5 0.1 200 / 10%)");
	});

	it("replaces an existing alpha", () => {
		expect(withAlpha("oklch(0.5 0.1 200 / 5%)", 0.25)).toBe("oklch(0.5 0.1 200 / 25%)");
	});
});
