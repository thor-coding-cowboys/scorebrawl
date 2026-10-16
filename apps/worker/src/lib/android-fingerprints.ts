const SHA256_BYTES = 32;

// A base64url fingerprint is 43 characters, so the 64-character test is unambiguous.
const HEX_FINGERPRINT = /^[0-9a-fA-F]{64}$/;

function decodeBase64(value: string): Uint8Array | null {
	const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
	try {
		return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
	} catch {
		return null;
	}
}

/**
 * Decodes one SHA-256 signing-certificate fingerprint pasted as hex (colons,
 * spaces and dashes optional) or base64/base64url (padding optional). Returns
 * null for anything that is not exactly 32 bytes, so a bad paste is dropped
 * rather than shipped as a plausible-looking wrong fingerprint.
 */
export function decodeFingerprint(value: string): Uint8Array | null {
	const compact = value.replace(/[:\s-]/g, "");
	const bytes = HEX_FINGERPRINT.test(compact)
		? Uint8Array.from(compact.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16))
		: decodeBase64(value.trim());
	return bytes?.length === SHA256_BYTES ? bytes : null;
}

/** Parses the comma-separated `PASSKEY_ANDROID_APK_KEY_HASHES` value, dropping invalid entries. */
export function parseAndroidFingerprints(raw?: string): Uint8Array[] {
	return (raw ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map(decodeFingerprint)
		.filter((bytes): bytes is Uint8Array => bytes !== null);
}

/** The format `assetlinks.json` wants: colon-separated uppercase hex. */
export function toColonHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

/** The format Android puts in `clientDataJSON.origin`: unpadded base64url. */
export function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}
