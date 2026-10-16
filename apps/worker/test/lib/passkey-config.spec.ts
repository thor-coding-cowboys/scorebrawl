import { describe, expect, it } from "vitest";
import { buildPasskeyConfig } from "../../src/lib/passkey-config";

const FINGERPRINT_BASE64URL = "FG3pg8VzBlDY7rmVLzT8ZBagg0LmHb6oigSWsj_PROU";
const FINGERPRINT_HEX =
	"14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";

describe("buildPasskeyConfig", () => {
	it("derives rpID and origin from the request origin", () => {
		expect(buildPasskeyConfig({ requestOrigin: "https://scorebrawl.com" })).toEqual({
			rpID: "scorebrawl.com",
			origin: ["https://scorebrawl.com"],
		});
	});

	it("derives rpID from the host for non-local origins", () => {
		expect(buildPasskeyConfig({ requestOrigin: "https://pr-1.workers.dev" }).rpID).toBe(
			"pr-1.workers.dev"
		);
	});

	it("normalises local origins to the vite dev origin", () => {
		expect(buildPasskeyConfig({ requestOrigin: "https://scorebrawl.localhost:1355" })).toEqual({
			rpID: "localhost",
			origin: ["http://localhost:5173"],
		});
		expect(buildPasskeyConfig({})).toEqual({
			rpID: "localhost",
			origin: ["http://localhost:5173"],
		});
	});

	it("appends one unpadded base64url apk-key-hash origin per valid fingerprint", () => {
		const config = buildPasskeyConfig({
			requestOrigin: "https://scorebrawl.com",
			androidKeyHashes: ` ${FINGERPRINT_HEX} , ,not-a-fingerprint, ${FINGERPRINT_BASE64URL}= `,
		});
		expect(config.origin).toEqual([
			"https://scorebrawl.com",
			`android:apk-key-hash:${FINGERPRINT_BASE64URL}`,
			`android:apk-key-hash:${FINGERPRINT_BASE64URL}`,
		]);
		expect(config.rpID).toBe("scorebrawl.com");
	});

	it("honours the rpID override without changing the origin list", () => {
		const config = buildPasskeyConfig({
			requestOrigin: "https://pr-1.workers.dev",
			rpIdOverride: "preview.scorebrawl.com",
		});
		expect(config.rpID).toBe("preview.scorebrawl.com");
		expect(config.origin).toEqual(["https://pr-1.workers.dev"]);
	});
});
