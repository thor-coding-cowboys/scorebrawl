import { describe, expect, it } from "vitest";
import { getSessionInvalidations, type SessionInvalidationSource } from "./index";

const source: SessionInvalidationSource = {
	session: {
		getById: { queryKey: (input: { sessionId: string }) => ["session", "getById", input] },
		getActive: { queryKey: (input: { seasonSlug: string }) => ["session", "getActive", input] },
	},
	seasonPlayer: {
		getStanding: {
			queryKey: (input: { seasonSlug: string }) => ["seasonPlayer", "getStanding", input],
		},
	},
	seasonTeam: {
		getStanding: {
			queryKey: (input: { seasonSlug: string }) => ["seasonTeam", "getStanding", input],
		},
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
