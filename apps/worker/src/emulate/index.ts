import { Hono } from "hono";

/**
 * Worker-native stand-in for the standalone `emulate` CLI (GitHub/Google OAuth).
 *
 * Why not `@emulators/*`: those packages read font files and use `filePersistence`
 * at module load, which crashes in workerd (`fileURLToPath(undefined)`), and the
 * preview deploy path bundles with wrangler's esbuild where Node builtins cannot
 * be aliased.
 *
 * Everything here is stateless: authorization codes and access tokens are
 * base64url-encoded grants, so authorize and token exchange can land in different
 * isolates. Mounted only when `EMULATE_ENABLED=true` (local dev, e2e, previews).
 */

type EmulatedUser = { email: string; name: string; login: string };

const USERS: EmulatedUser[] = [
	{ email: "seed@example.com", name: "Seed User", login: "seed" },
	{ email: "emulate-e2e@example.com", name: "Emulated E2E", login: "emulate-e2e" },
	{ email: "signup-e2e@example.com", name: "Signup E2E", login: "signup-e2e" },
	{ email: "invitee-e2e@example.com", name: "Invited E2E", login: "invitee-e2e" },
];

const CODE_TTL_MS = 5 * 60_000;
const TOKEN_TTL_MS = 60 * 60_000;

type Grant = { email: string; name: string; login: string; exp: number };

function encode(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value: string): string | null {
	try {
		const padded = value
			.replace(/-/g, "+")
			.replace(/_/g, "/")
			.padEnd(Math.ceil(value.length / 4) * 4, "=");
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return null;
	}
}

function encodeGrant(grant: Grant): string {
	return encode(JSON.stringify(grant));
}

function decodeGrant(value: string | undefined): Grant | null {
	if (!value) return null;
	const raw = decode(value);
	if (!raw) return null;
	try {
		const grant = JSON.parse(raw) as Partial<Grant>;
		if (typeof grant.email !== "string" || typeof grant.exp !== "number") return null;
		if (grant.exp < Date.now()) return null;
		return {
			email: grant.email,
			name: typeof grant.name === "string" ? grant.name : grant.email.split("@")[0],
			login: typeof grant.login === "string" ? grant.login : grant.email.split("@")[0],
			exp: grant.exp,
		};
	} catch {
		return null;
	}
}

function userForEmail(email: string): EmulatedUser {
	const seeded = USERS.find((user) => user.email === email);
	if (seeded) return seeded;
	const local = email.split("@")[0];
	return { email, name: local, login: local };
}

function userForLogin(login: string): EmulatedUser {
	const seeded = USERS.find((user) => user.login === login || user.email === login);
	if (seeded) return seeded;
	const email = login.includes("@") ? login : `${login}@example.com`;
	const local = email.split("@")[0];
	return { email, name: local, login: local };
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

type ParamMap = Record<string, string | undefined>;

function hiddenInputs(params: ParamMap, keys: string[]): string {
	return keys
		.filter((key) => params[key])
		.map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(params[key] ?? "")}">`)
		.join("");
}

function pickerPage({
	title,
	action,
	params,
	inputs,
	field,
	choices,
}: {
	title: string;
	action: string;
	params: ParamMap;
	inputs: string[];
	field: "email" | "login";
	choices: EmulatedUser[];
}): string {
	const buttons = choices
		.map(
			(user) => `<button type="submit" name="${field}" value="${escapeHtml(user[field])}">
				<span class="primary">${escapeHtml(user[field])}</span>
				<span class="secondary">${escapeHtml(user.name)}</span>
			</button>`
		)
		.join("");

	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>${escapeHtml(title)}</title>
		<style>
			:root { color-scheme: light dark; }
			body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f5f5; }
			@media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } }
			main { width: min(420px, calc(100vw - 2rem)); background: Canvas; border: 1px solid #d4d4d4; border-radius: 12px; padding: 1.5rem; }
			h1 { font-size: 1.1rem; margin: 0 0 0.25rem; }
			p { margin: 0 0 1rem; color: #6b7280; font-size: 0.85rem; }
			form { display: grid; gap: 0.5rem; }
			button { font: inherit; text-align: left; padding: 0.75rem; border-radius: 8px; border: 1px solid #d4d4d4; background: transparent; cursor: pointer; }
			button:hover { border-color: #2563eb; }
			.primary { display: block; font-weight: 600; }
			.secondary { display: block; font-size: 0.8rem; color: #6b7280; }
			.badge { display: inline-block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 0.75rem; }
		</style>
	</head>
	<body>
		<main>
			<span class="badge">Emulated provider</span>
			<h1>${escapeHtml(title)}</h1>
			<p>Choose an account to continue.</p>
			<form method="post" action="${escapeHtml(action)}">
				${hiddenInputs(params, inputs)}
				${buttons}
			</form>
		</main>
	</body>
</html>`;
}

function redirectWithCode(redirectUri: string, code: string, state: string | undefined): string {
	const url = new URL(redirectUri);
	url.searchParams.set("code", code);
	if (state) url.searchParams.set("state", state);
	return url.toString();
}

/**
 * Code/token exchange used directly by `better-auth` (see emulatedSocialProviders)
 * so the OAuth callback never makes a Worker-to-itself HTTP request. Previews
 * and local dev therefore do not depend on loop-back fetches or local TLS trust.
 */
export function exchangeEmulatedCode(
	provider: "google" | "github",
	code: string
): { accessToken: string; scopes: string[]; expiresAt: Date } | null {
	const grant = decodeGrant(code);
	if (!grant) return null;
	return {
		accessToken: encodeGrant({ ...grant, exp: Date.now() + TOKEN_TTL_MS }),
		scopes: provider === "google" ? ["openid", "email", "profile"] : ["read:user", "user:email"],
		expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
	};
}

export type EmulatedProfile = {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	login: string;
};

export function emulatedTokenProfile(accessToken: string | undefined): EmulatedProfile | null {
	const grant = decodeGrant(accessToken);
	if (!grant) return null;
	return {
		id: providerSubject(grant.login),
		email: grant.email,
		emailVerified: true,
		name: grant.name,
		login: grant.login,
	};
}

function providerSubject(login: string): string {
	let id = 0;
	for (const char of login) id = (id * 31 + char.charCodeAt(0)) % 1_000_000;
	return String(id + 1);
}

function formValue(form: Record<string, string | File>, key: string): string {
	const value = form[key];
	return typeof value === "string" ? value : "";
}

export const emulateApp = new Hono().basePath("/emulate");

emulateApp.get("/google/o/oauth2/v2/auth", (c) => {
	const params = c.req.query();
	return c.html(
		pickerPage({
			title: "Google",
			action: "/emulate/google/o/oauth2/v2/auth/callback",
			params,
			inputs: [
				"redirect_uri",
				"state",
				"scope",
				"client_id",
				"code_challenge",
				"code_challenge_method",
				"nonce",
			],
			field: "email",
			choices: USERS,
		})
	);
});

emulateApp.post("/google/o/oauth2/v2/auth/callback", async (c) => {
	const form = await c.req.parseBody();
	const email = formValue(form, "email");
	const redirectUri = formValue(form, "redirect_uri");
	if (!email || !redirectUri) return c.text("Missing email or redirect_uri", 400);

	const user = userForEmail(email);
	const code = encodeGrant({ ...user, exp: Date.now() + CODE_TTL_MS });
	return c.redirect(
		redirectWithCode(redirectUri, code, formValue(form, "state") || undefined),
		302
	);
});

emulateApp.post("/google/oauth2/token", async (c) => {
	const form = await c.req.parseBody();
	const tokens = exchangeEmulatedCode("google", formValue(form, "code"));
	if (!tokens) return c.json({ error: "invalid_grant" }, 400);

	return c.json({
		access_token: tokens.accessToken,
		token_type: "Bearer",
		expires_in: TOKEN_TTL_MS / 1000,
		scope: tokens.scopes.join(" "),
	});
});

emulateApp.get("/google/oauth2/v2/userinfo", (c) => {
	const profile = emulatedTokenProfile(c.req.header("authorization")?.replace(/^Bearer\s+/i, ""));
	if (!profile) return c.json({ error: "invalid_token" }, 401);

	return c.json({
		sub: profile.email,
		email: profile.email,
		email_verified: profile.emailVerified,
		name: profile.name,
		picture: null,
	});
});

emulateApp.get("/github/login/oauth/authorize", (c) => {
	const params = c.req.query();
	return c.html(
		pickerPage({
			title: "GitHub",
			action: "/emulate/github/login/oauth/callback",
			params,
			inputs: ["redirect_uri", "state", "scope", "client_id"],
			field: "login",
			choices: USERS,
		})
	);
});

emulateApp.post("/github/login/oauth/callback", async (c) => {
	const form = await c.req.parseBody();
	const login = formValue(form, "login");
	const redirectUri = formValue(form, "redirect_uri");
	if (!login || !redirectUri) return c.text("Missing login or redirect_uri", 400);

	const user = userForLogin(login);
	const code = encodeGrant({ ...user, exp: Date.now() + CODE_TTL_MS });
	return c.redirect(
		redirectWithCode(redirectUri, code, formValue(form, "state") || undefined),
		302
	);
});

emulateApp.post("/github/login/oauth/access_token", async (c) => {
	const form = await c.req.parseBody();
	const tokens = exchangeEmulatedCode("github", formValue(form, "code"));
	if (!tokens) return c.json({ error: "invalid_grant" }, 400);

	return c.json({
		access_token: tokens.accessToken,
		token_type: "bearer",
		scope: tokens.scopes.join(","),
	});
});

emulateApp.get("/github/user", (c) => {
	const profile = emulatedTokenProfile(c.req.header("authorization")?.replace(/^Bearer\s+/i, ""));
	if (!profile) return c.json({ error: "invalid_token" }, 401);

	return c.json({
		id: Number(profile.id),
		login: profile.login,
		name: profile.name,
		email: profile.email,
		avatar_url: undefined,
	});
});

emulateApp.get("/github/user/emails", (c) => {
	const profile = emulatedTokenProfile(c.req.header("authorization")?.replace(/^Bearer\s+/i, ""));
	if (!profile) return c.json({ error: "invalid_token" }, 401);

	return c.json([{ email: profile.email, primary: true, verified: true }]);
});

emulateApp.get("/health", (c) => c.json({ ok: true }));
