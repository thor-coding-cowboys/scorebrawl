import { describe, expect, it } from "vitest";
import {
	getSeasonInvalidations,
	getSessionInvalidations,
	type SeasonInvalidationSource,
	type SessionInvalidationSource,
} from "./index";

const source: SessionInvalidationSource & SeasonInvalidationSource = {
	session: {
		getById: { queryKey: (input: { sessionId: string }) => ["session", "getById", input] },
		getActive: { queryKey: (input: { seasonSlug: string }) => ["session", "getActive", input] },
	},
	seasonPlayer: {
		getStanding: {
			queryKey: (input: { seasonSlug: string }) => ["seasonPlayer", "getStanding", input],
		},
		getTop: { queryKey: (input: { seasonSlug: string }) => ["seasonPlayer", "getTop", input] },
		getAll: { queryKey: (input: { seasonSlug: string }) => ["seasonPlayer", "getAll", input] },
	},
	seasonTeam: {
		getStanding: {
			queryKey: (input: { seasonSlug: string }) => ["seasonTeam", "getStanding", input],
		},
	},
	season: {
		getCountInfo: {
			queryKey: (input: { seasonSlug: string }) => ["season", "getCountInfo", input],
		},
		getFixtures: {
			queryKey: (input: { seasonSlug: string }) => ["season", "getFixtures", input],
		},
	},
	match: {
		getLatest: { queryKey: (input: { seasonSlug: string }) => ["match", "getLatest", input] },
		getAll: { queryKey: (input: { seasonSlug: string }) => ["match", "getAll", input] },
	},
};

describe("getSessionInvalidations", () => {
	it("returns the session, active session, player and team standing query keys", () => {
		expect(getSessionInvalidations(source, { sessionId: "s1", seasonSlug: "season-1" })).toEqual([
			["session", "getById", { sessionId: "s1" }],
			["session", "getActive", { seasonSlug: "season-1" }],
			["seasonPlayer", "getStanding", { seasonSlug: "season-1" }],
			["seasonTeam", "getStanding", { seasonSlug: "season-1" }],
		]);
	});
});

describe("getSeasonInvalidations", () => {
	it("returns every season-scoped query key affected by a match or session write", () => {
		expect(getSeasonInvalidations(source, { seasonSlug: "season-1", seasonId: "id-1" })).toEqual([
			["seasonPlayer", "getStanding", { seasonSlug: "season-1" }],
			["seasonTeam", "getStanding", { seasonSlug: "season-1" }],
			["seasonPlayer", "getTop", { seasonSlug: "season-1" }],
			["seasonPlayer", "getAll", { seasonSlug: "season-1" }],
			["season", "getCountInfo", { seasonSlug: "season-1" }],
			["season", "getFixtures", { seasonSlug: "season-1" }],
			["match", "getLatest", { seasonSlug: "season-1" }],
			["match", "getAll", { seasonSlug: "season-1" }],
			["session", "getActive", { seasonSlug: "season-1" }],
			["infinite-matches", "id-1"],
			["matches", "id-1"],
		]);
	});

	it("omits the infinite match list key when the season id is unknown", () => {
		expect(getSeasonInvalidations(source, { seasonSlug: "season-1" })).not.toContainEqual([
			"infinite-matches",
			expect.anything(),
		]);
	});
});
