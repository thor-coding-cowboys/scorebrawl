import { SELF, env } from "cloudflare:test";
import { getDb } from "../../src/db/index";
import { createAuth } from "../../src/lib/better-auth";
import { authHeaders } from "./auth-context-util";

export interface OAuthTestClient {
	clientId: string;
	clientSecret: string | null;
	redirectUri: string;
	scope: string;
}

export interface AccessTokenResult {
	accessToken: string;
	refreshToken?: string;
	payload?: Record<string, unknown>;
}

function base64UrlEncode(input: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < input.length; i++) {
		binary += String.fromCharCode(input[i]);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
	const bytes = new Uint8Array(64);
	crypto.getRandomValues(bytes);
	let verifier = "";
	for (let i = 0; i < 64; i++) {
		verifier += chars[bytes[i] % chars.length];
	}
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
}

export async function registerOAuthClient({
	sessionToken,
	scope = "openid profile email offline_access create:matches read:matches",
	redirectUri = "https://app.example.com/callback",
	skipConsent = true,
	requirePkce = true,
	name = "Test OAuth Client",
}: {
	sessionToken: string;
	scope?: string;
	redirectUri?: string;
	skipConsent?: boolean;
	requirePkce?: boolean;
	name?: string;
}): Promise<OAuthTestClient> {
	const db = getDb(env.DB);
	const auth = createAuth({
		db,
		betterAuthSecret: env.BETTER_AUTH_SECRET,
		baseURL: "http://localhost",
		oauthResource: "https://scorebrawl.com/api/v1",
	});
	await auth.$context;

	const res = await auth.api.adminCreateOAuthClient({
		headers: new Headers(authHeaders(sessionToken)),
		body: {
			redirect_uris: [redirectUri],
			scope,
			client_name: name,
			token_endpoint_auth_method: "none",
			application_type: "web",
			grant_types: ["authorization_code", "refresh_token"],
			require_pkce: requirePkce,
			skip_consent: skipConsent,
		},
	});

	return {
		clientId:
			(res as { client_id?: string; clientId?: string }).client_id ??
			(res as { client_id?: string; clientId?: string }).clientId ??
			"",
		clientSecret:
			(res as { client_secret?: string | null; clientSecret?: string | null }).client_secret ??
			(res as { client_secret?: string | null; clientSecret?: string | null }).clientSecret ??
			null,
		redirectUri,
		scope,
	};
}

export async function getAccessToken({
	sessionToken,
	client,
	scopes = "openid profile email offline_access create:matches read:matches",
	resource = "https://scorebrawl.com/api/v1",
	acceptConsent = false,
}: {
	sessionToken: string;
	client: OAuthTestClient;
	scopes?: string;
	resource?: string;
	acceptConsent?: boolean;
}): Promise<AccessTokenResult> {
	const { verifier, challenge } = await createPkce();

	const authorizeUrl = new URL("http://example.com/api/auth/oauth2/authorize");
	authorizeUrl.searchParams.set("response_type", "code");
	authorizeUrl.searchParams.set("client_id", client.clientId);
	authorizeUrl.searchParams.set("redirect_uri", client.redirectUri);
	authorizeUrl.searchParams.set("scope", scopes);
	authorizeUrl.searchParams.set("code_challenge", challenge);
	authorizeUrl.searchParams.set("code_challenge_method", "S256");
	authorizeUrl.searchParams.set("resource", resource);

	const authorizeRes = await SELF.fetch(authorizeUrl.toString(), {
		headers: { ...authHeaders(sessionToken), Accept: "application/json" },
		redirect: "manual",
	});

	const authorizeJson = (await authorizeRes.json()) as { redirect?: boolean; url?: string };
	if (!authorizeRes.ok || !authorizeJson.url) {
		throw new Error(`Authorize failed (${authorizeRes.status}): ${JSON.stringify(authorizeJson)}`);
	}

	const location = new URL(authorizeJson.url, "http://example.com");
	let code = location.searchParams.get("code");

	// Consent flow: redirect points at the consent page; accept it server-side.
	if (!code && acceptConsent) {
		const consentUrl = new URL("http://example.com/api/auth/oauth2/consent");
		const consentRes = await SELF.fetch(consentUrl.toString(), {
			method: "POST",
			headers: {
				...authHeaders(sessionToken),
				"Content-Type": "application/json",
				Accept: "application/json",
				Origin: "http://example.com",
			},
			body: JSON.stringify({
				accept: true,
				oauth_query: location.search.slice(1),
			}),
			redirect: "manual",
		});
		const consentJson = (await consentRes.json()) as { redirect?: boolean; url?: string };
		if (!consentRes.ok || !consentJson.url) {
			throw new Error(`Consent failed (${consentRes.status}): ${JSON.stringify(consentJson)}`);
		}
		code = new URL(consentJson.url).searchParams.get("code");
	}

	if (!code) {
		throw new Error(`No authorization code returned. URL: ${location}`);
	}

	const tokenBody = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: client.redirectUri,
		client_id: client.clientId,
		code_verifier: verifier,
	});

	const tokenRes = await SELF.fetch("http://example.com/api/auth/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: tokenBody.toString(),
	});

	if (!tokenRes.ok) {
		const body = await tokenRes.text();
		throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
	}

	const data = (await tokenRes.json()) as { access_token: string; refresh_token?: string };
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
	};
}
