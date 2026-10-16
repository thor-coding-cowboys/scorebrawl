import { Hono } from "hono";
import { parseAndroidFingerprints, toColonHex } from "../lib/android-fingerprints";
import type { HonoEnv } from "../middleware/context";

// Apple Developer team ID (apps/mobile/eas.json) + the iOS bundle identifier.
const APPLE_APP_ID = "VWB9AT6XKY.com.scorebrawl";

const ANDROID_PACKAGE_NAME = "com.scorebrawl";

/** Both routes ship the bare `application/json` content type the criterion pins. */
export const wellKnownRouter = new Hono<HonoEnv>()
	.get("/apple-app-site-association", (c) => {
		const response = c.json({ webcredentials: { apps: [APPLE_APP_ID] } });
		response.headers.set("content-type", "application/json");
		return response;
	})
	.get("/assetlinks.json", (c) => {
		const fingerprints = parseAndroidFingerprints(c.env.PASSKEY_ANDROID_APK_KEY_HASHES).map(
			toColonHex
		);

		// TODO: set PASSKEY_ANDROID_APK_KEY_HASHES (debug + Play App Signing
		// SHA-256s). Android passkey sign-in fails while this is empty.
		const response = c.json([
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
		response.headers.set("content-type", "application/json");
		return response;
	})
	.all("*", (c) => c.notFound());
