import { describe, expect, it } from "vitest";

import { AVATAR_TONE_COUNT, avatarTones, selectAvatarIndex } from "./avatar";

describe("selectAvatarIndex", () => {
	it("is deterministic and in range", () => {
		const index = selectAvatarIndex("Ada Lovelace");
		expect(index).toBe(selectAvatarIndex("Ada Lovelace"));
		expect(index).toBeGreaterThanOrEqual(0);
		expect(index).toBeLessThan(AVATAR_TONE_COUNT);
	});

	it("normalises case and whitespace", () => {
		expect(selectAvatarIndex("  ada   lovelace ")).toBe(selectAvatarIndex("ada lovelace"));
	});

	it("returns -1 when there is no name to hash", () => {
		expect(selectAvatarIndex("")).toBe(-1);
		expect(selectAvatarIndex("   ")).toBe(-1);
	});

	it("stays within range across many names", () => {
		for (let i = 0; i < 500; i++) {
			const index = selectAvatarIndex(`player-${i}`);
			expect(index).toBeGreaterThanOrEqual(0);
			expect(index).toBeLessThan(AVATAR_TONE_COUNT);
		}
	});
});

describe("avatarTones", () => {
	it("emits hex only — no oklch may reach React Native", () => {
		for (const mode of ["light", "dark"] as const) {
			for (const tone of avatarTones(mode)) {
				expect(tone.text).toMatch(/^#[0-9a-f]{6}$/);
				expect(tone.background).toMatch(/^#[0-9a-f]{8}$/);
				expect(tone.border).toMatch(/^#[0-9a-f]{8}$/);
			}
		}
	});

	it("exposes one tone per selectable index", () => {
		expect(avatarTones("light")).toHaveLength(AVATAR_TONE_COUNT);
	});
});
