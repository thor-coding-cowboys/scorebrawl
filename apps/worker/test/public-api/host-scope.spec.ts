import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { enforceHostScope, isPublicApiPath } from "../../src/public-api/host-scope";
import type { HonoEnv } from "../../src/middleware/context";

const env = {
	PROD_URL: "https://scorebrawl.com",
	PROD_PUBLIC_API_URL: "https://api.scorebrawl.com",
} as Env;

const app = new Hono<HonoEnv>().use("*", enforceHostScope).all("*", (c) => c.text("ok"));

const call = (url: string) => app.request(url, {}, env);

describe("isPublicApiPath", () => {
	it.each([
		["/v1", true],
		["/v1/me", true],
		["/leagues/v1/abc/sessions", true],
		["/leagues/v10", false],
		["/leagues/my-league", false],
		["/api/trpc/x", false],
	])("%s -> %s", (path, expected) => {
		expect(isPublicApiPath(path)).toBe(expected);
	});
});

describe("enforceHostScope", () => {
	it("blocks public API paths on the app host", async () => {
		expect((await call("https://scorebrawl.com/v1/me")).status).toBe(404);
		expect((await call("https://scorebrawl.com/leagues/v1/x/sessions")).status).toBe(404);
	});

	it("allows app paths on the app host", async () => {
		expect((await call("https://scorebrawl.com/api/trpc/x")).status).toBe(200);
	});

	it("allows public API paths on the API host", async () => {
		expect((await call("https://api.scorebrawl.com/leagues/v1/x/sessions")).status).toBe(200);
	});

	it("blocks app paths on the API host", async () => {
		expect((await call("https://api.scorebrawl.com/api/trpc/x")).status).toBe(404);
		expect((await call("https://api.scorebrawl.com/")).status).toBe(404);
	});

	it("allows both surfaces on other hosts (preview)", async () => {
		expect((await call("https://pr-1.workers.dev/v1/me")).status).toBe(200);
		expect((await call("https://pr-1.workers.dev/api/trpc/x")).status).toBe(200);
	});
});
