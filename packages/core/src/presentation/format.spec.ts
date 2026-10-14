import { describe, expect, it } from "vitest";
import { formatDuration, rotationLabel, truncateSlug } from "./format";

const start = new Date("2026-01-01T10:00:00Z");
const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

describe("formatDuration", () => {
	it("reports an open-ended session", () => {
		expect(formatDuration(start, null)).toBe("In progress");
	});

	it("formats minutes under an hour", () => {
		expect(formatDuration(start, at(0))).toBe("0m");
		expect(formatDuration(start, at(59))).toBe("59m");
	});

	it("formats whole and partial hours", () => {
		expect(formatDuration(start, at(60))).toBe("1h");
		expect(formatDuration(start, at(61))).toBe("1h 1m");
		expect(formatDuration(start, at(90))).toBe("1h 30m");
		expect(formatDuration(start, at(1500))).toBe("25h");
	});
});

describe("rotationLabel", () => {
	it("labels both modes and passes anything else through", () => {
		expect(rotationLabel("winner-stays")).toBe("Winner Stays");
		expect(rotationLabel("manual")).toBe("Manual");
		expect(rotationLabel("other")).toBe("other");
	});
});

describe("truncateSlug", () => {
	it("leaves short slugs alone", () => {
		expect(truncateSlug("short")).toBe("short");
		expect(truncateSlug("0123456789")).toBe("0123456789");
	});

	it("truncates to the default 10 characters with an ellipsis", () => {
		expect(truncateSlug("0123456789abc")).toBe("0123456789…");
	});

	it("honours a custom max length", () => {
		expect(truncateSlug("0123456789abc", 3)).toBe("012…");
	});
});
