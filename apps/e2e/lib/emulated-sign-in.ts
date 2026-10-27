import type { APIRequestContext } from "@playwright/test";

export type EmulatedProvider = "google" | "github";

/** The picker endpoint hands the code back to the app callback on the same origin. */
function callbackUrl(authorizeUrl: URL, provider: EmulatedProvider): URL {
	const pathname =
		provider === "google"
			? `${authorizeUrl.pathname.replace(/\/$/, "")}/callback`
			: authorizeUrl.pathname.replace(/\/authorize$/, "/callback");
	return new URL(pathname, authorizeUrl.origin);
}

/**
 * Completes an OAuth round trip against a local `emulate` provider without the
 * browser picker: ask better-auth for the authorize URL, post the chosen user to
 * the emulator, then hit the app callback so the session cookie lands in the
 * request context (which shares its cookie jar with the page).
 *
 * The emulated provider accepts any email/login (seeded users are only listed
 * in the picker), so new-account flows work too.
 */
export async function signInWithEmulatedProvider(
	request: APIRequestContext,
	{
		apiBaseURL,
		provider,
		email,
		login,
	}: {
		apiBaseURL: string;
		provider: EmulatedProvider;
		email: string;
		/** Emulated GitHub login, required for the github provider. */
		login?: string;
	}
) {
	const origin = new URL(apiBaseURL).origin;

	// The first request after the dev server boots can race the worker cold
	// start (the asset server answers before the Worker does), so retry 5xx.
	let signInResponse = await request.post(`${origin}/api/auth/sign-in/social`, {
		data: { provider, callbackURL: "/" },
		headers: { Origin: origin },
	});
	for (let attempt = 0; attempt < 3 && signInResponse.status() >= 500; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
		signInResponse = await request.post(`${origin}/api/auth/sign-in/social`, {
			data: { provider, callbackURL: "/" },
			headers: { Origin: origin },
		});
	}
	if (!signInResponse.ok()) {
		throw new Error(
			`sign-in/social failed for ${provider}: ${signInResponse.status()} ${await signInResponse.text()}`
		);
	}

	const { url } = (await signInResponse.json()) as { url?: string };
	if (!url) throw new Error(`sign-in/social returned no url for ${provider}`);

	const authorizeUrl = new URL(url);
	const params = authorizeUrl.searchParams;
	const form =
		provider === "google"
			? {
					email,
					redirect_uri: params.get("redirect_uri") ?? "",
					scope: params.get("scope") ?? "",
					state: params.get("state") ?? "",
					nonce: params.get("nonce") ?? "",
					client_id: params.get("client_id") ?? "",
					code_challenge: params.get("code_challenge") ?? "",
					code_challenge_method: params.get("code_challenge_method") ?? "",
				}
			: {
					login: login ?? email,
					redirect_uri: params.get("redirect_uri") ?? "",
					scope: params.get("scope") ?? "",
					state: params.get("state") ?? "",
					client_id: params.get("client_id") ?? "",
				};

	const callback = await request.post(callbackUrl(authorizeUrl, provider).toString(), {
		form,
		maxRedirects: 0,
	});
	const location = callback.headers().location;
	if (!location) {
		throw new Error(`emulated ${provider} callback did not redirect: ${callback.status()}`);
	}

	// better-auth verifies the state cookie and sets the session cookie here.
	const appCallback = await request.get(location, { maxRedirects: 0 });
	if (appCallback.status() >= 400) {
		throw new Error(`app callback failed for ${provider}: ${appCallback.status()}`);
	}

	const session = await request.get(`${origin}/api/auth/get-session`);
	const signedIn = (await session.json()) as { user?: { email: string } } | null;
	if (signedIn?.user?.email !== email) {
		throw new Error(`session not established for ${email} (got ${signedIn?.user?.email})`);
	}
}
