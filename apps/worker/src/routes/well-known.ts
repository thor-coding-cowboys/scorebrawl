import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";

// Apple Developer team ID (apps/mobile/eas.json) + the iOS bundle identifier.
const APPLE_APP_ID = "VWB9AT6XKY.com.scorebrawl";

const ANDROID_PACKAGE_NAME = "com.scorebrawl";

/** Apple and Android both want colon-separated uppercase hex; we store base64url. */
export function sha256Base64ToHex(value: string): string {
	const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
	const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

export const wellKnownRouter = new Hono<HonoEnv>()
	.get("/apple-app-site-association", (c) => c.json({ webcredentials: { apps: [APPLE_APP_ID] } }))
	.get("/assetlinks.json", (c) => {
		const fingerprints = (c.env.PASSKEY_ANDROID_APK_KEY_HASHES ?? "")
			.split(",")
			.map((hash) => hash.trim())
			.filter(Boolean)
			.map(sha256Base64ToHex);

		// TODO: set PASSKEY_ANDROID_APK_KEY_HASHES (debug + Play App Signing
		// SHA-256s, base64url). Android passkey sign-in fails while this is empty.
		return c.json([
			{
				relation: [
					"delegate_permission/common.get_login_creds",
					"delegate_permission/common.handle_all_urls",
				],
				target: {
					namespace: "android_app",
					package_name: ANDROID_PACKAGE_NAME,
					sha256_cert_fingerprints: fingerprints,
				},
			},
		]);
	});
