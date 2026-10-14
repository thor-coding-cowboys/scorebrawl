import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const INDEX_CSS_URL = new URL("../../../../apps/web/src/index.css", import.meta.url);

const readIndexCss = (): string => readFileSync(INDEX_CSS_URL, "utf8");

describe("web index.css", () => {
	it("authors no literal colours outside @theme", () => {
		const body = readIndexCss().replace(/@theme inline\s*\{[\s\S]*?\}/, "");
		expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(body).not.toMatch(/(?<![-\w])(oklch|rgba?|hsla?)\(/);
	});

	it("points palette classes at the shared ramps", () => {
		const css = readIndexCss();
		expect(css).toContain("--color-blue-500: var(--blue-500);");
		expect(css).toContain("--color-red-950: var(--red-950);");
		expect(css).toContain("--color-cyan-200: var(--cyan-200);");
	});

	it("never compounds an already-translucent token inside color-mix", () => {
		// color-mix multiplies alpha, so mixing a token that already carries
		// alpha (e.g. --divider is 25%) silently dims the result.
		const translucent = [
			"--divider:",
			"--divider-border:",
			"--divider-strong:",
			"--overlay:",
			"--overlay-soft:",
			"--vignette:",
		].map((token) => token.slice(0, -1));

		const body = readIndexCss().replace(/@theme inline\s*\{[\s\S]*?\}/, "");
		for (const match of body.matchAll(/color-mix\([^)]*?(--[a-z-]+)[^)]*?\)/g)) {
			expect(translucent, `color-mix uses ${match[1]}`).not.toContain(match[1]);
		}
	});
});
