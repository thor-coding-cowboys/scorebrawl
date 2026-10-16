import { describe, expect, it } from "vitest";
import { defaultNotificationPreferences } from "../../src/db/schema/user-preferences-schema";
import {
	buildStreakPushEvents,
	teamsFormed,
	type PushEvent,
} from "../../src/services/notification-events";
import { selectEligibleEventsByUser } from "../../src/services/push-notification";

const enabledPrefs = defaultNotificationPreferences;

function sessionEvent(overrides: Partial<PushEvent> = {}): PushEvent {
	return {
		title: "Session started",
		body: "Ada started a session",
		payload: {
			type: "session:start",
			leagueSlug: "league",
			seasonSlug: "season",
			sessionId: "session",
		},
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
			title: "Match recorded",
			body: "Ada 1-0 Bob",
			payload: {
				type: "match:recorded",
				leagueSlug: "league",
				seasonSlug: "season",
				matchId: "match",
			},
		};
		const result = selectEligibleEventsByUser(
			["u1"],
			[{ userId: "u1", ...enabledPrefs, notifySessionStarted: false }],
			[sessionEvent(), matchEvent]
		);
		expect(result.get("u1")?.map((event) => event.payload.type)).toEqual(["match:recorded"]);
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
			title: "Streak reached",
			body: "Ada is on a 3-win streak",
			payload: {
				type: "streak",
				leagueSlug: "league",
				seasonSlug: "season",
				playerId: "p1",
			},
		};
		const result = selectEligibleEventsByUser(["actor"], [], [streakEvent]);
		expect(result.get("actor")).toHaveLength(1);
	});
});

describe("buildStreakPushEvents", () => {
	it("builds one deep-linkable event per player", () => {
		const events = buildStreakPushEvents(
			[
				{ playerId: "p1", playerName: "Ada", streak: 5 },
				{ playerId: "p2", playerName: "Bob", streak: 3 },
			],
			{ leagueSlug: "league", seasonSlug: "season" }
		);
		expect(events).toHaveLength(2);
		expect(events[0]).toEqual({
			title: "Streak reached",
			body: "Ada is on a 5-game win streak",
			payload: {
				type: "streak",
				leagueSlug: "league",
				seasonSlug: "season",
				playerId: "p1",
			},
		});
		expect(events[1]).toEqual({
			title: "Streak reached",
			body: "Bob is on a 3-game win streak",
			payload: {
				type: "streak",
				leagueSlug: "league",
				seasonSlug: "season",
				playerId: "p2",
			},
		});
	});

	it("labels losing streaks with a positive count", () => {
		const events = buildStreakPushEvents([{ playerId: "p1", playerName: "Ada", streak: -5 }], {
			leagueSlug: "league",
			seasonSlug: "season",
		});
		expect(events[0]?.body).toBe("Ada is on a 5-game losing streak");
	});

	it.each([5, 10, 15])("renders a %i-game win streak", (threshold) => {
		const events = buildStreakPushEvents(
			[{ playerId: "p1", playerName: "Ada", streak: threshold }],
			{ leagueSlug: "league", seasonSlug: "season" }
		);
		expect(events[0]?.body).toBe(`Ada is on a ${threshold}-game win streak`);
	});

	it.each([
		[-5, 5],
		[-10, 10],
		[-15, 15],
	])("renders a %i losing streak as a positive count", (streak, count) => {
		const events = buildStreakPushEvents([{ playerId: "p1", playerName: "Ada", streak }], {
			leagueSlug: "league",
			seasonSlug: "season",
		});
		expect(events[0]?.body).toBe(`Ada is on a ${count}-game losing streak`);
	});

	it("returns an empty array with no players", () => {
		expect(buildStreakPushEvents([], { leagueSlug: "l", seasonSlug: "s" })).toEqual([]);
	});
});

describe("teamsFormed", () => {
	const payload = {
		type: "session:teams",
		leagueSlug: "league",
		seasonSlug: "season",
		sessionId: "session",
	} as const;

	it("renders team vs team with player names", () => {
		const event = teamsFormed(payload, {
			home: ["Ada", "Bob"],
			away: ["Carol", "Dave"],
			actorId: "actor",
		});
		expect(event.title).toBe("New teams");
		expect(event.body).toBe("Ada & Bob vs Carol & Dave");
		expect(event.payload).toEqual(payload);
		expect(event.excludeUserId).toBe("actor");
	});

	it("renders single-player sides", () => {
		const event = teamsFormed(payload, { home: ["Ada"], away: ["Bob"], actorId: "actor" });
		expect(event.body).toBe("Ada vs Bob");
	});

	it("renders three-player sides", () => {
		const event = teamsFormed(payload, {
			home: ["Ada", "Bob", "Cy"],
			away: ["Dee", "Eve", "Fay"],
			actorId: "actor",
		});
		expect(event.body).toBe("Ada & Bob & Cy vs Dee & Eve & Fay");
	});
});

describe("selectEligibleEventsByUser teams formed gating", () => {
	it("excludes users with notifyTeamsFormed off", () => {
		const event = teamsFormed(
			{ type: "session:teams", leagueSlug: "league", seasonSlug: "season", sessionId: "session" },
			{ home: ["Ada"], away: ["Bob"], actorId: "actor" }
		);
		const result = selectEligibleEventsByUser(
			["u1"],
			[{ userId: "u1", ...enabledPrefs, notifyTeamsFormed: false }],
			[event]
		);
		expect(result.has("u1")).toBe(false);
	});

	it("includes users with notifyTeamsFormed on", () => {
		const event = teamsFormed(
			{ type: "session:teams", leagueSlug: "league", seasonSlug: "season", sessionId: "session" },
			{ home: ["Ada"], away: ["Bob"], actorId: "actor" }
		);
		const result = selectEligibleEventsByUser(["u1"], [], [event]);
		expect(result.get("u1")).toHaveLength(1);
	});
});
