import { env } from "cloudflare:test";
import { randCompanyName, randEmail, randFullName, randSlug } from "@ngneat/falso";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { user } from "../../src/db/schema/auth-schema";
import { createAuth } from "../../src/lib/better-auth";

export interface UserInput {
	email?: string;
	password?: string;
	name?: string;
}

export interface OrganizationInput {
	name?: string;
	slug?: string;
}

export interface AuthContext {
	sessionToken: string;
	user: UserInput & { id: string; email: string; password: string; name: string };
	organization: OrganizationInput & { id: string; name: string; slug: string };
}

/**
 * Generate user input with defaults
 */
export function aUser(overrides: UserInput = {}): UserInput & {
	email: string;
	password: string;
	name: string;
} {
	return {
		email: randEmail(),
		password: "password123",
		name: randFullName(),
		...overrides,
	};
}

/**
 * Generate organization input with defaults
 */
export function anOrganization(overrides: OrganizationInput = {}): OrganizationInput & {
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
 * Create an authenticated context with a user and organization
 */
export async function createAuthContext(
	options: { user?: UserInput; organization?: OrganizationInput } = {}
): Promise<AuthContext> {
	const db = getDb(env.DB);
	const auth = createAuth({
		db,
		betterAuthSecret: env.BETTER_AUTH_SECRET,
	});

	const userInput = aUser(options.user);
	const orgInput = anOrganization(options.organization);

	// Sign up a test user
	const { headers } = await auth.api.signUpEmail({
		body: userInput,
		returnHeaders: true,
	});

	const cookies = headers.get("set-cookie");
	const token = cookies?.match(/better-auth\.session_token=([^;]+)/)?.[1];
	if (!token) throw new Error("No session token in response");
	let sessionToken = token;

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

	// Fetch the created user to get their ID
	const [createdUser] = await db.select().from(user).where(eq(user.email, userInput.email));
	if (!createdUser) throw new Error("Failed to fetch created user");

	return {
		sessionToken,
		user: {
			...userInput,
			id: createdUser.id,
		},
		organization: {
			id: org.id,
			name: org.name,
			slug: org.slug,
		},
	};
}

/**
 * Create an additional organization for an authenticated user
 */
export async function createOrganization(
	sessionToken: string,
	overrides: OrganizationInput = {}
): Promise<{ id: string; name: string; slug: string }> {
	const db = getDb(env.DB);
	const auth = createAuth({
		db,
		betterAuthSecret: env.BETTER_AUTH_SECRET,
	});

	const orgInput = anOrganization(overrides);

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
 * Create an authenticated user without an organization
 */
export async function createUser(overrides: UserInput = {}): Promise<{
	sessionToken: string;
	user: UserInput & { id: string; email: string; password: string; name: string };
}> {
	const db = getDb(env.DB);
	const auth = createAuth({
		db,
		betterAuthSecret: env.BETTER_AUTH_SECRET,
	});

	const userInput = aUser(overrides);

	const { headers } = await auth.api.signUpEmail({
		body: userInput,
		returnHeaders: true,
	});

	const cookies = headers.get("set-cookie");
	const token = cookies?.match(/better-auth\.session_token=([^;]+)/)?.[1];
	if (!token) throw new Error("No session token in response");

	// Fetch the created user to get their ID
	const [createdUser] = await db.select().from(user).where(eq(user.email, userInput.email));
	if (!createdUser) throw new Error("Failed to fetch created user");

	return {
		sessionToken: token,
		user: {
			...userInput,
			id: createdUser.id,
		},
	};
}
