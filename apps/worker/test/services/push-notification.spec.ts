import { describe, expect, it } from "vitest";
import {
	buildStreakPushEvents,
	type PushEvent,
	selectEligibleEventsByUser,
} from "../../src/services/push-notification";

const enabledPrefs = {
	pushEnabled: true,
	notifySessionStarted: true,
	notifyMatchRecorded: true,
	notifyAchievementUnlocked: true,
	notifyStreakReached: true,
};

function sessionEvent(overrides: Partial<PushEvent> = {}): PushEvent {
	return {
		type: "session:start",
		title: "Session started",
		body: "Ada started a session",
		data: { type: "session:start" },
		...overrides,
	};
}

describe("selectEligibleEventsByUser", () => {
	it("includes users with no preference row using defaults", () => {
		const result = selectEligibleEventsByUser(["u1"], [], [sessionEvent()]);
		expect(result.get("u1")).toHaveLength(1);
	});

	it("excludes users whose master toggle is off", () => {
		const result = selectEligibleEventsByUser(
			["u1"],
			[{ userId: "u1", ...enabledPrefs, pushEnabled: false }],
			[sessionEvent()]
		);
		expect(result.has("u1")).toBe(false);
	});

	it("excludes events whose per-event toggle is off", () => {
		const result = selectEligibleEventsByUser(
			["u1"],
			[{ userId: "u1", ...enabledPrefs, notifySessionStarted: false }],
			[sessionEvent()]
		);
		expect(result.has("u1")).toBe(false);
	});

	it("keeps other event types when one toggle is off", () => {
		const matchEvent: PushEvent = {
			type: "match:recorded",
			title: "Match recorded",
			body: "Ada 1-0 Bob",
			data: { type: "match:recorded" },
		};
		const result = selectEligibleEventsByUser(
			["u1"],
			[{ userId: "u1", ...enabledPrefs, notifySessionStarted: false }],
			[sessionEvent(), matchEvent]
		);
		expect(result.get("u1")?.map((event) => event.type)).toEqual(["match:recorded"]);
	});

	it("excludes the actor for an event carrying excludeUserId", () => {
		const result = selectEligibleEventsByUser(
			["actor", "member"],
			[],
			[sessionEvent({ excludeUserId: "actor" })]
		);
		expect(result.has("actor")).toBe(false);
		expect(result.get("member")).toHaveLength(1);
	});

	it("does not exclude the actor for events without excludeUserId", () => {
		const streakEvent: PushEvent = {
			type: "streak",
			title: "Streak reached",
			body: "Ada is on a 3-win streak",
			data: { type: "streak" },
		};
		const result = selectEligibleEventsByUser(["actor"], [], [streakEvent]);
		expect(result.get("actor")).toHaveLength(1);
	});
});

describe("buildStreakPushEvents", () => {
	it("builds one deep-linkable event per player", () => {
		const events = buildStreakPushEvents([{ playerId: "p1", playerName: "Ada", streak: 5 }], {
			leagueSlug: "league",
			seasonSlug: "season",
		});
		expect(events).toEqual([
			{
				type: "streak",
				title: "Streak reached",
				body: "Ada is on a 5-win streak",
				data: {
					type: "streak",
					leagueSlug: "league",
					seasonSlug: "season",
					playerId: "p1",
				},
			},
		]);
	});

	it("returns an empty array with no players", () => {
		expect(buildStreakPushEvents([], { leagueSlug: "l", seasonSlug: "s" })).toEqual([]);
	});
});
