import { parseAndroidFingerprints, toBase64Url } from "./android-fingerprints";

const LOCAL_DEV_ORIGIN = "http://localhost:5173";

export interface PasskeyConfig {
	rpID: string;
	origin: string[];
}

export interface PasskeyConfigInput {
	requestOrigin?: string;
	rpIdOverride?: string;
	androidKeyHashes?: string;
}

function resolveOrigin(requestOrigin?: string): string {
	if (!requestOrigin) return LOCAL_DEV_ORIGIN;
	if (requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1")) {
		return LOCAL_DEV_ORIGIN;
	}
	return requestOrigin;
}

function originHostname(origin: string): string {
	try {
		return new URL(origin).hostname;
	} catch {
		return "localhost";
	}
}

function androidOrigins(raw?: string): string[] {
	return parseAndroidFingerprints(raw).map((bytes) => `android:apk-key-hash:${toBase64Url(bytes)}`);
}

/**
 * Derives the WebAuthn relying party config from the request.
 *
 * Native clients send no `Origin` header, so the caller falls back to the
 * request host — in production that yields `scorebrawl.com`, the same rpID the
 * web app uses, which is what lets one passkey work on both surfaces.
 */
export function buildPasskeyConfig({
	requestOrigin,
	rpIdOverride,
	androidKeyHashes,
}: PasskeyConfigInput): PasskeyConfig {
	const baseOrigin = resolveOrigin(requestOrigin);
	return {
		rpID: rpIdOverride || originHostname(baseOrigin),
		origin: [baseOrigin, ...androidOrigins(androidKeyHashes)],
	};
}
