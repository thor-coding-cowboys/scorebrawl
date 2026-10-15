import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";

// Apple Developer team ID (apps/mobile/eas.json) + the iOS bundle identifier.
const APPLE_APP_ID = "VWB9AT6XKY.com.scorebrawl";

const ANDROID_PACKAGE_NAME = "com.scorebrawl";

// 32-byte SHA-256 as colon-separated uppercase hex: 64 hex digits + 31 colons.
const FINGERPRINT_HEX_LENGTH = 95;

// A fingerprint pasted as hex, with or without `:`/space/`-` separators. A
// base64url fingerprint is 43 characters, so the 64-character test is unambiguous.
const HEX_FINGERPRINT = /^[0-9a-fA-F]{64}$/;

/** Apple and Android both want colon-separated uppercase hex; we store base64url. */
export function sha256Base64ToHex(value: string): string {
	const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
	const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

/**
 * Normalises a SHA-256 fingerprint to colon-separated uppercase hex. Accepts
 * base64url/base64 or hex (colons, spaces and dashes optional) and returns null
 * for anything that is not exactly 32 bytes, so a bad paste is dropped rather
 * than shipped as a plausible-looking wrong fingerprint.
 */
export function fingerprintToHex(value: string): string | null {
	const compact = value.replace(/[:\s-]/g, "");
	if (HEX_FINGERPRINT.test(compact)) {
		const pairs = compact.toUpperCase().match(/.{2}/g);
		return pairs ? pairs.join(":") : null;
	}
	try {
		const hex = sha256Base64ToHex(value);
		return hex.length === FINGERPRINT_HEX_LENGTH ? hex : null;
	} catch {
		return null;
	}
}

/** Both routes ship the bare `application/json` content type the criterion pins. */
export const wellKnownRouter = new Hono<HonoEnv>()
	.get("/apple-app-site-association", (c) => {
		const response = c.json({ webcredentials: { apps: [APPLE_APP_ID] } });
		response.headers.set("content-type", "application/json");
		return response;
	})
	.get("/assetlinks.json", (c) => {
		const fingerprints = (c.env.PASSKEY_ANDROID_APK_KEY_HASHES ?? "")
			.split(",")
			.map((hash) => hash.trim())
			.filter(Boolean)
			.map(fingerprintToHex)
			.filter((hex): hex is string => hex !== null);

		// TODO: set PASSKEY_ANDROID_APK_KEY_HASHES (debug + Play App Signing
		// SHA-256s, base64url or hex). Android passkey sign-in fails while this is empty.
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
