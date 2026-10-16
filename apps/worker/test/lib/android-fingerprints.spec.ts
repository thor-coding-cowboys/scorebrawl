import { describe, expect, it } from "vitest";
import {
	decodeFingerprint,
	parseAndroidFingerprints,
	toBase64Url,
	toColonHex,
} from "../../src/lib/android-fingerprints";

// A real SHA-256 fingerprint in both encodings, to pin url-safe decoding.
const FINGERPRINT_BASE64URL = "FG3pg8VzBlDY7rmVLzT8ZBagg0LmHb6oigSWsj_PROU";
const FINGERPRINT_HEX =
	"14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";

const roundTrip = (value: string) => {
	const bytes = decodeFingerprint(value);
	return bytes && { hex: toColonHex(bytes), base64url: toBase64Url(bytes) };
};

describe("decodeFingerprint", () => {
	it("normalises base64url, padded base64, colon hex and plain hex to the same bytes", () => {
		const expected = { hex: FINGERPRINT_HEX, base64url: FINGERPRINT_BASE64URL };
		expect(roundTrip(FINGERPRINT_BASE64URL)).toEqual(expected);
		expect(roundTrip(`${FINGERPRINT_BASE64URL}=`)).toEqual(expected);
		expect(roundTrip(FINGERPRINT_HEX)).toEqual(expected);
		expect(roundTrip(FINGERPRINT_HEX.replace(/:/g, "").toLowerCase())).toEqual(expected);
	});

	it("returns null for values that are not exactly 32 bytes", () => {
		expect(decodeFingerprint("short")).toBeNull();
		expect(decodeFingerprint("AAAA")).toBeNull();
		expect(decodeFingerprint("not!base64!")).toBeNull();
	});
});

describe("parseAndroidFingerprints", () => {
	it("splits on commas and drops blank or invalid entries", () => {
		const parsed = parseAndroidFingerprints(
			` ${FINGERPRINT_HEX} , , AAAA, ${FINGERPRINT_BASE64URL}`
		);
		expect(parsed.map(toBase64Url)).toEqual([FINGERPRINT_BASE64URL, FINGERPRINT_BASE64URL]);
	});

	it("returns nothing when unset", () => {
		expect(parseAndroidFingerprints(undefined)).toEqual([]);
		expect(parseAndroidFingerprints("")).toEqual([]);
	});
});
