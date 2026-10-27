import { signInWithEmulatedProvider } from "../lib/emulated-sign-in";
import { API_BASE_URL, expect, SEED_LEAGUE, SEED_USER, signIn, test } from "./fixtures/auth";

// Seeded in the emulated provider but not in D1: signing in creates the account.
const INVITEE = "invitee-e2e@example.com";

test.describe("Invitation flow", () => {
	test("accepted invitation is reflected in the session and navigates into the league", async ({
		page,
		request,
	}) => {
		// Create an invitation for the new user as the seeded league owner.
		await signInWithEmulatedProvider(request, {
			apiBaseURL: API_BASE_URL,
			provider: "google",
			email: SEED_USER.email,
		});

		const orgsRes = await request.get("/api/auth/organization/list");
		const orgs = await orgsRes.json();
		const seedOrg = orgs.find((o: { slug: string }) => o.slug === SEED_LEAGUE.slug);
		expect(seedOrg).toBeDefined();

		const inviteRes = await request.post("/api/auth/organization/invite-member", {
			headers: {
				"Content-Type": "application/json",
				Origin: new URL(API_BASE_URL).origin,
			},
			data: { organizationId: seedOrg.id, email: INVITEE, role: "member" },
		});
		const inviteBody = (await inviteRes.json().catch(() => null)) as { id?: string } | null;
		expect(inviteRes.ok(), JSON.stringify(inviteBody)).toBeTruthy();
		const invite = inviteBody as { id: string };
		expect(invite.id).toBeDefined();

		// Clear the owner session before signing in as the invited user.
		await request.post("/api/auth/sign-out", {
			data: {},
			headers: { Origin: new URL(API_BASE_URL).origin },
		});

		await signIn(page, INVITEE);
		await expect(page).toHaveURL(new RegExp(`/accept-invitation/${invite.id}`), {
			timeout: 15000,
		});

		// Accept the invitation
		await page.getByRole("button", { name: "Accept Invitation" }).click();

		// The session must reflect the accepted invite: navigate into the accepted league
		await expect(page).toHaveURL(new RegExp(`/leagues/${SEED_LEAGUE.slug}`), { timeout: 15000 });

		// Sidebar active league switches to the accepted league
		await expect(
			page.getByRole("button", { name: new RegExp(`/${SEED_LEAGUE.slug}`) })
		).toBeVisible({ timeout: 15000 });

		// No stale pending invitation: going home routes to the active league, not the accept page
		await page.goto("/", { waitUntil: "networkidle" });
		await expect(page).toHaveURL(new RegExp(`/leagues/${SEED_LEAGUE.slug}`), { timeout: 15000 });
	});
});
