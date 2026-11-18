import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function oauthResourceCount(): Promise<number> {
	const row = await env.DB.prepare("SELECT count(*) AS count FROM oauth_resource").first<{
		count: number;
	}>();
	return row?.count ?? 0;
}

describe("auth instance reuse across requests", () => {
	it("does not re-initialize the instance for a second request", async () => {
		const first = await SELF.fetch("http://reuse.example/.well-known/oauth-protected-resource");
		expect(first.status).toBe(200);
		await first.text();
		expect(await oauthResourceCount()).toBeGreaterThan(0);

		// Plugin init seeds these rows. Reusing the cached MCP instance must not
		// seed them again, otherwise the second request would restore the rows.
		await env.DB.prepare("DELETE FROM oauth_resource").run();
		const second = await SELF.fetch("http://reuse.example/.well-known/oauth-protected-resource");
		expect(second.status).toBe(200);
		await second.text();

		expect(await oauthResourceCount()).toBe(0);
	});

	it("serves ordinary auth without initializing the MCP plugin", async () => {
		const res = await SELF.fetch("http://lean.example/api/auth/get-session");

		expect(res.status).toBe(200);
		await res.text();
		expect(await oauthResourceCount()).toBe(0);
	});

	it("serves concurrent first requests from one instance", async () => {
		const responses = await Promise.all([
			SELF.fetch("http://concurrent.example/api/auth/get-session"),
			SELF.fetch("http://concurrent.example/api/auth/get-session"),
			SELF.fetch("http://concurrent.example/api/auth/get-session"),
		]);

		expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
	});
});
