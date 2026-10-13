import { test, expect, signIn, SEED_USER, SEED_LEAGUE } from "./fixtures/auth";

test.describe("Public API keys", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	test("league key (created in UI) and personal key authenticate against the public API", async ({
		page,
	}) => {
		const stamp = Date.now();

		// Personal key: no UI, created through tRPC with the session cookie.
		const personalRes = await page.request.post("/api/trpc/personalApiKey.create", {
			data: {
				json: {
					name: `e2e personal ${stamp}`,
					scopes: ["profile:read", "league:read"],
					expiry: "30d",
				},
			},
		});
		expect(personalRes.ok()).toBe(true);
		const personalKey = (await personalRes.json()).result.data.json.key as string;
		expect(personalKey).toMatch(/^sbp_/);

		// League key: full UI flow.
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/api-keys`);
		await page.getByRole("button", { name: "New API Key" }).click();
		await page.locator("#api-key-name").fill(`e2e league ${stamp}`);
		await page.locator("label", { hasText: "session:stop" }).click();
		await page.getByRole("button", { name: "Create", exact: true }).click();
		const revealed = page.locator("code.break-all");
		await expect(revealed).toBeVisible({ timeout: 10000 });
		const leagueKey = (await revealed.innerText()).trim();
		expect(leagueKey).toMatch(/^sbk_/);
		await page.getByRole("button", { name: "Dismiss" }).click();

		const api = page.request;

		// --- personal API (/v1) ---
		expect((await api.get("/v1/me")).status()).toBe(401);
		const me = await api.get("/v1/me", { headers: { "x-api-key": personalKey } });
		expect(me.status()).toBe(200);
		expect((await me.json()).user.email).toBe(SEED_USER.email);

		const leagues = await api.get("/v1/leagues", { headers: { "x-api-key": personalKey } });
		expect(leagues.status()).toBe(200);
		const seedLeague = ((await leagues.json()).leagues as { id: string; slug: string }[]).find(
			(l) => l.slug === SEED_LEAGUE.slug
		);
		expect(seedLeague).toBeDefined();
		const leagueId = seedLeague?.id ?? "";

		// league key must not work on the personal API
		expect((await api.get("/v1/me", { headers: { "x-api-key": leagueKey } })).status()).toBe(401);

		// --- league API (/leagues/v1) ---
		const base = "/leagues/v1/sessions/active";
		const logBody = { data: { home: 1, away: 0 }, headers: { "x-api-key": leagueKey } };

		// no key -> 401
		expect((await api.post(`${base}/match/log`, { data: { home: 1, away: 0 } })).status()).toBe(
			401
		);
		// wrong scope -> 403
		expect((await api.post(`${base}/match/log`, logBody)).status()).toBe(403);
		// right scope -> authorized (business result may be 2xx/4xx, never 401/403)
		const end = await api.post(`${base}/end`, { headers: { "x-api-key": leagueKey } });
		expect([401, 403]).not.toContain(end.status());
		// live score: scope enforced (key has only session:stop)
		expect(
			(
				await api.put(`${base}/match/score`, {
					data: { home: 1, away: 0 },
					headers: { "x-api-key": leagueKey },
				})
			).status()
		).toBe(403);
		// cancel needs its own scope (key has only session:stop)
		expect(
			(await api.delete(`${base}/match`, { headers: { "x-api-key": leagueKey } })).status()
		).toBe(403);
		// path with explicit leagueId still works and is checked against the key
		expect(
			(
				await api.post(`/leagues/v1/${leagueId}/sessions/active/end`, {
					headers: { "x-api-key": leagueKey },
				})
			).status()
		).not.toBe(403);
		// key is bound to one league
		const otherLeague = await api.post("/leagues/v1/not-this-league/sessions/active/end", {
			headers: { "x-api-key": leagueKey },
		});
		expect(otherLeague.status()).toBe(403);
		// personal key is not a league key
		expect(
			(await api.post(`${base}/end`, { headers: { "x-api-key": personalKey } })).status()
		).toBe(401);
	});
});
