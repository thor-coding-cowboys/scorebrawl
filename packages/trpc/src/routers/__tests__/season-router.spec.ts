import { createDb } from "@scorebrawl/database";
import { db } from "@scorebrawl/database/db";
import * as schema from "@scorebrawl/database/schema";
import type { Session, User } from "better-auth/types";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestLeague,
  createTestLeagueMember,
  createTestLeaguePlayers,
  createTestSeason,
  createTestSeasonPlayer,
  createTestSession,
  createTestUser,
} from "../../../test/test-utils";
import { createCaller } from "../../root";
import type { TRPCContext } from "../../trpc";

describe("seasonRouter", () => {
  let user: User;
  let session: Session;
  let mockContext: TRPCContext;
  let caller: ReturnType<typeof createCaller>;
  let league: Awaited<ReturnType<typeof createTestLeague>>;

  beforeEach(async () => {
    user = await createTestUser({ name: "Test User", email: "test@example.com" });
    session = await createTestSession(user.id);
    league = await createTestLeague(user.id, { name: "Test League" });

    mockContext = {
      headers: new Headers(),
      session: {
        session: session,
        user,
      },
      db: createDb(),
    };

    caller = createCaller(mockContext);
  });

  describe("create", () => {
    it("should create an ELO season as editor", async () => {
      // Create league players
      const _players = await createTestLeaguePlayers(league.id, 2);

      const input = {
        leagueSlug: league.slug,
        name: "Spring 2024",
        scoreType: "elo" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-06-01"),
        initialScore: 1200,
        kFactor: 32,
      };

      const result = await caller.season.create(input);

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result?.name).toBe("Spring 2024");
      expect(result.scoreType).toBe("elo");
      expect(result.initialScore).toBe(1200);
      expect(result.kFactor).toBe(32);

      // Verify in database
      const dbSeason = await db.query.Seasons.findFirst({
        where: (seasons, { eq }) => eq(seasons.id, result.id),
      });
      expect(dbSeason).toBeDefined();
      if (!dbSeason) throw new Error("Expected dbSeason");
      expect(dbSeason?.name).toBe("Spring 2024");

      // Verify season players were created
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, result.id),
      });
      expect(seasonPlayers).toHaveLength(2);
      expect(seasonPlayers.every((p) => p.score === 1200)).toBe(true);
    });

    it("should create a 3-1-0 season with fixtures", async () => {
      const _players = await createTestLeaguePlayers(league.id, 3);

      const input = {
        leagueSlug: league.slug,
        name: "Tournament 2024",
        scoreType: "3-1-0" as const,
        roundsPerPlayer: 2,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-06-01"),
      };

      const result = await caller.season.create(input);

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result?.scoreType).toBe("3-1-0");
      expect(result.initialScore).toBe(0);
      expect(result.rounds).toBe(2); // roundsPerPlayer value

      // Verify fixtures were created
      const fixtures = await db.query.SeasonFixtures.findMany({
        where: (fixtures, { eq }) => eq(fixtures.seasonId, result.id),
      });
      expect(fixtures.length).toBeGreaterThan(0);
    });

    it("should throw error if league has less than 2 players", async () => {
      // Create only one player
      await createTestLeaguePlayers(league.id, 1);

      const input = {
        leagueSlug: league.slug,
        name: "Spring 2024",
        scoreType: "elo" as const,
        startDate: new Date("2024-01-01"),
      };

      await expect(caller.season.create(input)).rejects.toThrow(
        "League must have at least 2 players to create a season",
      );
    });

    it("should throw error if end date is before start date", async () => {
      await createTestLeaguePlayers(league.id, 2);

      const input = {
        leagueSlug: league.slug,
        name: "Spring 2024",
        scoreType: "elo" as const,
        startDate: new Date("2024-06-01"),
        endDate: new Date("2024-01-01"),
      };

      await expect(caller.season.create(input)).rejects.toThrow(
        "End date must be after start date",
      );
    });

    it("should throw FORBIDDEN if user is not editor", async () => {
      const memberUser = await createTestUser({ name: "Member User" });
      const memberSession = await createTestSession(memberUser.id);
      await createTestLeagueMember(league.id, memberUser.id, "member");

      const memberContext: TRPCContext = {
        headers: new Headers(),
        session: {
          session: memberSession,
          user: memberUser,
        },
        db: createDb(),
      };
      const memberCaller = createCaller(memberContext);

      const input = {
        leagueSlug: league.slug,
        name: "Spring 2024",
        scoreType: "elo" as const,
        startDate: new Date("2024-01-01"),
      };

      await expect(memberCaller.season.create(input)).rejects.toThrow();
    });
  });

  describe("getBySlug", () => {
    it("should return season by slug", async () => {
      const season = await createTestSeason(league.id, user.id, {
        name: "Spring 2024",
        scoreType: "elo",
        initialScore: 1200,
      });

      const result = await caller.season.getBySlug({
        leagueSlug: league.slug,
        seasonSlug: season.slug,
      });

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result?.id).toBe(season.id);
      expect(result.name).toBe("Spring 2024");
      expect(result.scoreType).toBe("elo");
      expect(result.initialScore).toBe(1200);
    });

    it("should throw NOT_FOUND if season does not exist", async () => {
      await expect(
        caller.season.getBySlug({
          leagueSlug: league.slug,
          seasonSlug: "non-existent",
        }),
      ).rejects.toThrow();
    });
  });

  describe("getAll", () => {
    it("should return all seasons in a league", async () => {
      const _season1 = await createTestSeason(league.id, user.id, { name: "Spring 2024" });
      const _season2 = await createTestSeason(league.id, user.id, { name: "Fall 2024" });

      const result = await caller.season.getAll({ leagueSlug: league.slug });

      expect(result).toHaveLength(2);
      expect(result.map((s) => s.name).sort()).toEqual(["Fall 2024", "Spring 2024"]);
    });

    it("should return empty array when league has no seasons", async () => {
      const result = await caller.season.getAll({ leagueSlug: league.slug });

      expect(result).toHaveLength(0);
    });
  });

  describe("edit", () => {
    it.skip("should update season name as editor", async () => {
      const season = await createTestSeason(league.id, user.id, {
        name: "Spring 2024",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-06-01"),
      });

      const input = {
        leagueSlug: league.slug,
        seasonSlug: season.slug,
        name: "Updated Spring 2024",
      };

      const result = await caller.season.edit(input);

      expect(result.name).toBe("Updated Spring 2024");

      // Verify in database
      const dbSeason = await db.query.Seasons.findFirst({
        where: (seasons, { eq }) => eq(seasons.id, season.id),
      });
      expect(dbSeason?.name).toBe("Updated Spring 2024");
    });

    it("should prevent updating season settings after season has started", async () => {
      const season = await createTestSeason(league.id, user.id, {
        name: "Spring 2024",
        startDate: new Date("2020-01-01"), // Past date
        endDate: new Date("2025-06-01"),
      });

      const input = {
        leagueSlug: league.slug,
        seasonSlug: season.slug,
        initialScore: 1500,
      };

      await expect(caller.season.edit(input)).rejects.toThrow(
        "Can only update name of a season that has started",
      );
    });

    it("should throw FORBIDDEN if user is not editor", async () => {
      const season = await createTestSeason(league.id, user.id, { name: "Spring 2024" });

      const memberUser = await createTestUser({ name: "Member User" });
      const memberSession = await createTestSession(memberUser.id);
      await createTestLeagueMember(league.id, memberUser.id, "member");

      const memberContext: TRPCContext = {
        headers: new Headers(),
        session: {
          session: memberSession,
          user: memberUser,
        },
        db: createDb(),
      };
      const memberCaller = createCaller(memberContext);

      const input = {
        leagueSlug: league.slug,
        seasonSlug: season.slug,
        name: "Updated Spring 2024",
      };

      await expect(memberCaller.season.edit(input)).rejects.toThrow();
    });
  });

  describe("updateClosedStatus", () => {
    it("should close season as editor", async () => {
      const season = await createTestSeason(league.id, user.id, {
        name: "Spring 2024",
        closed: false,
      });

      const input = {
        leagueSlug: league.slug,
        seasonSlug: season.slug,
        closed: true,
      };

      const result = await caller.season.updateClosedStatus(input);

      expect(result.closed).toBe(true);

      // Verify in database
      const dbSeason = await db.query.Seasons.findFirst({
        where: (seasons, { eq }) => eq(seasons.id, season.id),
      });
      expect(dbSeason?.closed).toBe(true);
    });

    it("should reopen season as owner", async () => {
      const season = await createTestSeason(league.id, user.id, {
        name: "Spring 2024",
        closed: true,
      });

      const input = {
        leagueSlug: league.slug,
        seasonSlug: season.slug,
        closed: false,
      };

      const result = await caller.season.updateClosedStatus(input);

      expect(result.closed).toBe(false);
    });

    it("should throw NOT_FOUND if season belongs to different league", async () => {
      const otherLeague = await createTestLeague(user.id, { name: "Other League" });
      const season = await createTestSeason(otherLeague.id, user.id, { name: "Spring 2024" });

      const input = {
        leagueSlug: league.slug,
        seasonSlug: season.slug,
        closed: true,
      };

      await expect(caller.season.updateClosedStatus(input)).rejects.toThrow("Season not found");
    });
  });

  describe("findActive", () => {
    it("should return active season for league", async () => {
      const now = new Date();
      const activeSeason = await createTestSeason(league.id, user.id, {
        name: "Active Season",
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        closed: false,
      });

      const result = await caller.season.findActive({ leagueSlug: league.slug });

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result?.id).toBe(activeSeason.id);
    });

    it("should return undefined if no active season", async () => {
      // Create a closed season
      await createTestSeason(league.id, user.id, {
        name: "Closed Season",
        closed: true,
      });

      const result = await caller.season.findActive({ leagueSlug: league.slug });

      expect(result).toBeUndefined();
    });
  });

  describe("getFixtures", () => {
    it("should return fixtures for a season", async () => {
      const season = await createTestSeason(league.id, user.id, {
        name: "Tournament 2024",
        scoreType: "3-1-0",
        rounds: 2,
      });

      const players = await createTestLeaguePlayers(league.id, 2);
      const seasonPlayer1 = await createTestSeasonPlayer(season.id, players[0].id);
      const seasonPlayer2 = await createTestSeasonPlayer(season.id, players[1].id);

      // Create a fixture manually
      await db.insert(schema.SeasonFixtures).values({
        id: "fixture-1",
        seasonId: season.id,
        homePlayerId: seasonPlayer1.id,
        awayPlayerId: seasonPlayer2.id,
        round: 1,
        matchId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.season.getFixtures({
        leagueSlug: league.slug,
        seasonSlug: season.slug,
      });

      expect(result).toHaveLength(1);
      expect(result[0].homePlayerId).toBe(seasonPlayer1.id);
      expect(result[0].awayPlayerId).toBe(seasonPlayer2.id);
    });
  });

  describe("getCountInfo", () => {
    it("should return count information for season", async () => {
      const season = await createTestSeason(league.id, user.id, { name: "Spring 2024" });

      const result = await caller.season.getCountInfo({
        leagueSlug: league.slug,
        seasonSlug: season.slug,
      });

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result.matchCount).toBeDefined();
      expect(result.teamCount).toBeDefined();
      expect(result.playerCount).toBeDefined();
    });
  });
});
