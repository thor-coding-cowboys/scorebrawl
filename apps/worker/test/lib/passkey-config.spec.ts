import { describe, expect, it } from "vitest";
import { buildPasskeyConfig } from "../../src/lib/passkey-config";

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

	it("appends one apk-key-hash origin per configured fingerprint", () => {
		const config = buildPasskeyConfig({
			requestOrigin: "https://scorebrawl.com",
			androidKeyHashes: " AAA , ,BBB ",
		});
		expect(config.origin).toEqual([
			"https://scorebrawl.com",
			"android:apk-key-hash:AAA",
			"android:apk-key-hash:BBB",
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
