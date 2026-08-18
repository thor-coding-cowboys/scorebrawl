import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import { createAuth } from "../../src/lib/better-auth";
import { aUser } from "../setup/auth-context-util";

describe("email/password sign-in", () => {
	it("signs in an existing user created via sign-up", async () => {
		const db = getDb(env.DB);
		const auth = createAuth({ db, betterAuthSecret: env.BETTER_AUTH_SECRET });
		const userInput = aUser();

		await auth.api.signUpEmail({ body: userInput });

		// Regression test: better-auth's sign-in/email lookup joins the user
		// with its accounts (db.query), which requires drizzle relations to be
		// wired up. Without them this silently returns no accounts and sign-in
		// fails with 401 even though the credentials are correct.
		const { headers } = await auth.api.signInEmail({
			body: { email: userInput.email, password: userInput.password },
			returnHeaders: true,
		});

		const cookies = headers.get("set-cookie");
		expect(cookies).toMatch(/better-auth\.session_token=/);
	});
});
