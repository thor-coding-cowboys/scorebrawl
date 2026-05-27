import { describe, expect, it } from "vitest";
import { generateAuthCode, generateToken, hashToken } from "../../src/lib/mcp-tokens";

describe("mcp-tokens", () => {
	it("generates tokens with the scbr_ prefix", () => {
		const token = generateToken();
		expect(token.startsWith("scbr_")).toBe(true);
		expect(token.length).toBeGreaterThan(30);
	});

	it("generates unique tokens", () => {
		const a = generateToken();
		const b = generateToken();
		expect(a).not.toBe(b);
	});

	it("hashes the same token to the same value", async () => {
		const token = generateToken();
		const h1 = await hashToken(token);
		const h2 = await hashToken(token);
		expect(h1).toBe(h2);
		expect(h1).not.toBe(token);
		expect(h1).toMatch(/^[0-9a-f]{64}$/);
	});

	it("hashes different tokens to different values", async () => {
		const h1 = await hashToken(generateToken());
		const h2 = await hashToken(generateToken());
		expect(h1).not.toBe(h2);
	});

	it("generates unique auth codes", () => {
		const a = generateAuthCode();
		const b = generateAuthCode();
		expect(a).not.toBe(b);
		expect(a.length).toBeGreaterThanOrEqual(20);
	});
});
