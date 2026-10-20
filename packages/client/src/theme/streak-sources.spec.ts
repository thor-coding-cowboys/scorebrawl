import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const STREAK_SOURCES = [
	"../../../../apps/web/src/routes/-components/streak-avatar.tsx",
	"../../../../apps/web/src/routes/-components/streak-flyout.tsx",
	"../../../../apps/mobile/src/components/streak-avatar.tsx",
];

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

describe("streak surfaces", () => {
	it("author no literal colours outside packages/core/theme", () => {
		for (const path of STREAK_SOURCES) {
			const source = read(path);
			expect(source, path).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
			expect(source, path).not.toMatch(/(?<![-\w])(oklch|rgba?|hsla?)\(/);
		}
	});
});
