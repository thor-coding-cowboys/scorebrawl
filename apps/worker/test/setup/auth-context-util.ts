import { env } from "cloudflare:test";
import { randCompanyName, randEmail, randFullName, randSlug } from "@ngneat/falso";
import { makeSignature } from "better-auth/crypto";
import { getDb } from "../../src/db/index";
import { createAuth } from "../../src/lib/better-auth";

export interface UserInput {
	email?: string;
	name?: string;
}

export interface LeagueInput {
	name?: string;
	slug?: string;
}

export interface AuthContext {
	sessionToken: string;
	user: UserInput & { id: string; email: string; name: string };
	league: LeagueInput & { id: string; name: string; slug: string };
}

/**
 * Generate user input with defaults
 */
export function aUser(overrides: UserInput = {}): UserInput & {
	email: string;
	name: string;
} {
	return {
		email: randEmail(),
		name: randFullName(),
		...overrides,
	};
}

/**
 * Generate league input with defaults
 */
export function aLeague(overrides: LeagueInput = {}): LeagueInput & {
	name: string;
	slug: string;
} {
	const name = overrides.name ?? randCompanyName();
	return {
		name,
		slug: randSlug(),
		...overrides,
	};
}

/**
 * Helper to create auth headers with session token
 */
export function authHeaders(sessionToken: string): Record<string, string> {
	return {
		Cookie: `better-auth.session_token=${sessionToken}`,
	};
}

/**
 * Create a user plus a signed session cookie the same way the test-utils plugin
 * would. There is no password sign-up to lean on, and OAuth needs a provider
 * round trip, so the session is created through better-auth's internal adapter.
 */
async function createSessionForUser(auth: ReturnType<typeof createAuth>, input: UserInput) {
	const ctx = await auth.$context;
	const createdUser = await ctx.internalAdapter.createUser({ ...input, emailVerified: true });
	const session = await ctx.internalAdapter.createSession(createdUser.id, false, {}, true);
	const signature = await makeSignature(session.token, env.BETTER_AUTH_SECRET);
	return { user: createdUser, sessionToken: `${session.token}.${signature}` };
}

/**
 * Create an authenticated context with a user and league
 */
export async function createAuthContext(
	options: { user?: UserInput; league?: LeagueInput } = {}
): Promise<AuthContext> {
	const db = getDb(env.DB);
	const auth = createAuth({
		db,
		betterAuthSecret: env.BETTER_AUTH_SECRET,
	});

	const userInput = aUser(options.user);
	const orgInput = aLeague(options.league);

	const { user: createdUser, sessionToken: initialToken } = await createSessionForUser(
		auth,
		userInput
	);
	let sessionToken = initialToken;

	// Create an organization
	const org = await auth.api.createOrganization({
		body: orgInput,
		headers: new Headers(authHeaders(sessionToken)),
	});
	if (!org) throw new Error("Failed to create organization");

	// Set the organization as active
	const { headers: activeHeaders } = await auth.api.setActiveOrganization({
		body: { organizationId: org.id },
		headers: new Headers(authHeaders(sessionToken)),
		returnHeaders: true,
	});

	// Update session token if new one was issued
	const newCookies = activeHeaders.get("set-cookie");
	if (newCookies) {
		const newToken = newCookies.match(/better-auth\.session_token=([^;]+)/)?.[1];
		if (newToken) sessionToken = newToken;
	}

	return {
		sessionToken,
		user: {
			...userInput,
			id: createdUser.id,
		},
		league: {
			id: org.id,
			name: org.name,
			slug: org.slug,
		},
	};
}

/**
 * Create an additional league for an authenticated user
 */
export async function createLeague(
	sessionToken: string,
	overrides: LeagueInput = {}
): Promise<{ id: string; name: string; slug: string }> {
	const db = getDb(env.DB);
	const auth = createAuth({
		db,
		betterAuthSecret: env.BETTER_AUTH_SECRET,
	});

	const orgInput = aLeague(overrides);

	const org = await auth.api.createOrganization({
		body: orgInput,
		headers: new Headers(authHeaders(sessionToken)),
	});

	if (!org) throw new Error("Failed to create organization");

	return {
		id: org.id,
		name: org.name,
		slug: org.slug,
	};
}

/**
 * Create an authenticated user without a league
 */
export async function createUser(overrides: UserInput = {}): Promise<{
	sessionToken: string;
	user: UserInput & { id: string; email: string; name: string };
}> {
	const db = getDb(env.DB);
	const auth = createAuth({
		db,
		betterAuthSecret: env.BETTER_AUTH_SECRET,
	});

	const userInput = aUser(overrides);
	const { user: createdUser, sessionToken } = await createSessionForUser(auth, userInput);

	return {
		sessionToken,
		user: {
			...userInput,
			id: createdUser.id,
		},
	};
}

export function bearerHeaders(token: string): Record<string, string> {
	return { Authorization: `Bearer ${token}` };
}
