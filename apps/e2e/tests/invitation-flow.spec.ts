import { test, expect, generateTestUser, signUp, SEED_USER, SEED_LEAGUE } from "./fixtures/auth";

test.describe("Invitation flow", () => {
	test("accepted invitation is reflected in the session and navigates into the league", async ({
		page,
		request,
	}) => {
		const user = generateTestUser();

		await page.goto("/auth/sign-in");
		const origin = new URL(page.url()).origin;

		// Create an invitation for the new user as the seeded league owner (API)
		const signInRes = await request.post("/api/auth/sign-in/email", {
			headers: { "Content-Type": "application/json", Origin: origin },
			data: { email: SEED_USER.email, password: SEED_USER.password },
		});
		expect(signInRes.ok()).toBeTruthy();

		const orgsRes = await request.get("/api/auth/organization/list");
		const orgs = await orgsRes.json();
		const seedOrg = orgs.find((o: { slug: string }) => o.slug === SEED_LEAGUE.slug);
		expect(seedOrg).toBeDefined();

		const inviteRes = await request.post("/api/auth/organization/invite-member", {
			headers: { "Content-Type": "application/json", Origin: origin },
			data: { organizationId: seedOrg.id, email: user.email, role: "member" },
		});
		expect(inviteRes.ok()).toBeTruthy();
		const invite = await inviteRes.json();
		expect(invite.id).toBeDefined();

		// Clear the seed session before signing up the invited user
		await request.post("/api/auth/sign-out", {
			headers: { "Content-Type": "application/json", Origin: origin },
			data: {},
		});

		// Sign up the invited user; the app should route them to the accept page
		await signUp(page, user.name, user.email, user.password);
		await expect(page).toHaveURL(new RegExp(`/accept-invitation/${invite.id}`), {
			timeout: 15000,
		});

		// Accept the invitation
		await page.getByRole("button", { name: "Accept Invitation" }).click();

		// The session must reflect the accepted invite: navigate into the accepted league
		await expect(page).toHaveURL(new RegExp(`/leagues/${SEED_LEAGUE.slug}`), {
			timeout: 15000,
		});

		// Sidebar active league switches to the accepted league
		await expect(
			page.getByRole("button", { name: new RegExp(`/${SEED_LEAGUE.slug}`) })
		).toBeVisible({ timeout: 15000 });

		// No stale pending invitation: going home routes to the active league, not the accept page
		await page.goto("/", { waitUntil: "networkidle" });
		await expect(page).toHaveURL(new RegExp(`/leagues/${SEED_LEAGUE.slug}`), {
			timeout: 15000,
		});
	});
});
