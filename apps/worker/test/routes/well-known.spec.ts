import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { enforceHostScope } from "../../src/public-api/host-scope";
import { sha256Base64ToHex, wellKnownRouter } from "../../src/routes/well-known";
import type { HonoEnv } from "../../src/middleware/context";

// A real SHA-256 fingerprint in both encodings, to pin url-safe decoding.
const FINGERPRINT_BASE64URL = "FG3pg8VzBlDY7rmVLzT8ZBagg0LmHb6oigSWsj_PROU";
const FINGERPRINT_HEX =
	"14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";

const hostEnv = {
	PROD_URL: "https://scorebrawl.com",
	PROD_PUBLIC_API_URL: "https://api.scorebrawl.com",
};

const app = new Hono<HonoEnv>().use("*", enforceHostScope).route("/.well-known", wellKnownRouter);

const call = (path: string, env: Record<string, string> = {}) =>
	app.request(`https://scorebrawl.com/.well-known/${path}`, {}, {
		...hostEnv,
		...env,
	} as unknown as Env);

describe("sha256Base64ToHex", () => {
	it("decodes base64url into colon-separated uppercase hex", () => {
		expect(sha256Base64ToHex(FINGERPRINT_BASE64URL)).toBe(FINGERPRINT_HEX);
	});
});

describe("apple-app-site-association", () => {
	it("serves the webcredentials app id as JSON", async () => {
		const res = await call("apple-app-site-association");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		expect(await res.json()).toEqual({
			webcredentials: { apps: ["VWB9AT6XKY.com.scorebrawl"] },
		});
	});
});

describe("assetlinks.json", () => {
	it("returns an android_app target with an empty fingerprint list when unset", async () => {
		const res = await call("assetlinks.json");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		expect(await res.json()).toEqual([
			{
				relation: [
					"delegate_permission/common.get_login_creds",
					"delegate_permission/common.handle_all_urls",
				],
				target: {
					namespace: "android_app",
					package_name: "com.scorebrawl",
					sha256_cert_fingerprints: [],
				},
			},
		]);
	});

	it("converts configured fingerprints to hex", async () => {
		const res = await call("assetlinks.json", {
			PASSKEY_ANDROID_APK_KEY_HASHES: ` ${FINGERPRINT_BASE64URL} ,`,
		});
		const body = (await res.json()) as Array<{ target: { sha256_cert_fingerprints: string[] } }>;
		expect(body[0].target.sha256_cert_fingerprints).toEqual([FINGERPRINT_HEX]);
	});

	it("is not reachable on the API host", async () => {
		const res = await app.request(
			"https://api.scorebrawl.com/.well-known/assetlinks.json",
			{},
			hostEnv as unknown as Env
		);
		expect(res.status).toBe(404);
	});
});
