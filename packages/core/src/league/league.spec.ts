import { describe, expect, it } from "vitest";
import { DEFAULT_LEAGUE_LOGO, formatDate, getSeasonStatus } from "./index";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

describe("getSeasonStatus", () => {
	it("reports archived first", () => {
		expect(
			getSeasonStatus({
				archived: true,
				closed: true,
				startDate: new Date(now - DAY),
				endDate: new Date(now + DAY),
			})
		).toBe("archived");
	});

	it("reports locked for closed seasons", () => {
		expect(
			getSeasonStatus({
				archived: false,
				closed: true,
				startDate: new Date(now - DAY),
				endDate: new Date(now + DAY),
			})
		).toBe("locked");
	});

	it("reports upcoming before the start date", () => {
		expect(
			getSeasonStatus({
				archived: false,
				closed: false,
				startDate: new Date(now + DAY),
				endDate: new Date(now + 2 * DAY),
			})
		).toBe("upcoming");
	});

	it("reports ended after the end date", () => {
		expect(
			getSeasonStatus({
				archived: false,
				closed: false,
				startDate: new Date(now - 2 * DAY),
				endDate: new Date(now - DAY),
			})
		).toBe("ended");
	});

	it("reports active within the range", () => {
		expect(
			getSeasonStatus({
				archived: false,
				closed: false,
				startDate: new Date(now - DAY),
				endDate: new Date(now + DAY),
			})
		).toBe("active");
	});

	it("reports active when there is no end date", () => {
		expect(
			getSeasonStatus({
				archived: false,
				closed: false,
				startDate: new Date(now - DAY),
				endDate: null,
			})
		).toBe("active");
	});

	it("accepts date strings", () => {
		expect(
			getSeasonStatus({
				archived: false,
				closed: false,
				startDate: new Date(now + DAY).toISOString(),
				endDate: null,
			})
		).toBe("upcoming");
	});
});

describe("formatDate", () => {
	it("formats as a short US date", () => {
		expect(formatDate(new Date(2024, 2, 15))).toBe("Mar 15, 2024");
	});

	it("accepts date strings", () => {
		expect(formatDate(new Date(2024, 11, 1))).toBe("Dec 1, 2024");
	});
});

describe("DEFAULT_LEAGUE_LOGO", () => {
	it("is the shared fallback logo URL", () => {
		expect(DEFAULT_LEAGUE_LOGO).toBe("https://avatars.githubusercontent.com/u/246662916");
	});
});
