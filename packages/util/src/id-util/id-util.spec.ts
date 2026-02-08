import { describe, expect, it } from "vitest";
import {
	createUlid,
	newId,
	prefixes,
	type Prefix,
	ulid,
} from "./index.js";

describe("id-util", () => {
	describe("createUlid", () => {
		it("should create a valid ULID", () => {
			const id = createUlid();
			expect(id).toBeDefined();
			expect(typeof id).toBe("string");
			expect(id.length).toBe(26);
		});

		it("should create unique ULIDs", () => {
			const id1 = createUlid();
			const id2 = createUlid();
			expect(id1).not.toBe(id2);
		});
	});

	describe("newId", () => {
		it("should create an ID with match prefix", () => {
			const id = newId("match");
			expect(id.startsWith("mtch_")).toBe(true);
			const parts = id.split("_");
			expect(parts.length).toBe(2);
			expect(parts[0]).toBe("mtch");
			expect(parts[1].length).toBe(26);
		});

		it("should create an ID with season prefix", () => {
			const id = newId("season");
			expect(id.startsWith("sson_")).toBe(true);
		});

		it("should create an ID with player prefix", () => {
			const id = newId("player");
			expect(id.startsWith("plr_")).toBe(true);
		});

		it("should create an ID with team prefix", () => {
			const id = newId("team");
			expect(id.startsWith("team_")).toBe(true);
		});

		it("should create an ID with matchPlayer prefix", () => {
			const id = newId("matchPlayer");
			expect(id.startsWith("mp_")).toBe(true);
		});

		it("should create an ID with seasonPlayer prefix", () => {
			const id = newId("seasonPlayer");
			expect(id.startsWith("sp_")).toBe(true);
		});

		it("should create an ID with leaguePlayer prefix", () => {
			const id = newId("leaguePlayer");
			expect(id.startsWith("lp_")).toBe(true);
		});

		it("should create unique IDs with same prefix", () => {
			const id1 = newId("match");
			const id2 = newId("match");
			expect(id1).not.toBe(id2);
		});
	});

	describe("prefixes", () => {
		it("should have all expected prefixes", () => {
			expect(prefixes).toEqual({
				match: "mtch",
				season: "sson",
				player: "plr",
				team: "team",
				matchPlayer: "mp",
				seasonPlayer: "sp",
				leaguePlayer: "lp",
			});
		});
	});

	describe("ulid export", () => {
		it("should export the ulid function", () => {
			expect(typeof ulid).toBe("function");
			const id = ulid();
			expect(typeof id).toBe("string");
			expect(id.length).toBe(26);
		});
	});

	describe("Prefix type", () => {
		it("should accept valid prefix keys", () => {
			const validPrefixes: Prefix[] = [
				"match",
				"season",
				"player",
				"team",
				"matchPlayer",
				"seasonPlayer",
				"leaguePlayer",
			];
			expect(validPrefixes.length).toBe(7);
		});
	});
});
