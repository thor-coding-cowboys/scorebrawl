import { createDb } from "@scorebrawl/database";
import { db } from "@scorebrawl/database/db";
import * as schema from "@scorebrawl/database/schema";
import type { Session, User } from "better-auth/types";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestLeague,
  createTestLeaguePlayers,
  createTestSeason,
  createTestSeasonFixture,
  createTestSeasonPlayer,
  createTestSession,
  createTestUser,
} from "../../../test/test-utils";
import { createCaller } from "../../root";
import type { TRPCContext } from "../../trpc";

describe("matchRouter", () => {
  let user: User;
  let session: Session;
  let mockContext: TRPCContext;
  let caller: ReturnType<typeof createCaller>;
  let league: Awaited<ReturnType<typeof createTestLeague>>;
  let eloSeason: Awaited<ReturnType<typeof createTestSeason>>;
  let fixtureSeason: Awaited<ReturnType<typeof createTestSeason>>;
  let leaguePlayers: Awaited<ReturnType<typeof createTestLeaguePlayers>>;

  beforeEach(async () => {
    user = await createTestUser({ name: "Test User", email: "test@example.com" });
    session = await createTestSession(user.id);
    league = await createTestLeague(user.id, { name: "Test League" });

    // Create league players
    leaguePlayers = await createTestLeaguePlayers(league.id, 4);

    // Create ELO season
    eloSeason = await createTestSeason(league.id, user.id, {
      name: "ELO Season",
      scoreType: "elo",
      initialScore: 1200,
      kFactor: 32,
      closed: false,
    });

    // Create season players for ELO season
    for (const player of leaguePlayers) {
      await createTestSeasonPlayer(eloSeason.id, player.id, 1200);
    }

    // Create fixture season
    fixtureSeason = await createTestSeason(league.id, user.id, {
      name: "Tournament 2024",
      scoreType: "3-1-0",
      initialScore: 0,
      kFactor: -1,
      rounds: 2,
      closed: false,
    });

    // Create season players for fixture season
    for (const player of leaguePlayers) {
      await createTestSeasonPlayer(fixtureSeason.id, player.id, 0);
    }

    mockContext = {
      headers: new Headers(),
      session: {
        ...session,
        user,
      },
      db: createDb(),
    };

    caller = createCaller(mockContext);
  });

  describe("createEloMatch", () => {
    it("should create an ELO match", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });

      const input = {
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id] as [
          string,
          ...string[],
        ],
        awayTeamSeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id] as [
          string,
          ...string[],
        ],
        homeScore: 3,
        awayScore: 1,
      };

      const result = await caller.match.createEloMatch(input);

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result.homeScore).toBe(3);
      expect(result.awayScore).toBe(1);

      // Verify in database
      const dbMatch = await db.query.Matches.findFirst({
        where: (matches, { eq }) => eq(matches.id, result.id),
      });
      expect(dbMatch).toBeDefined();
      if (!dbMatch) throw new Error("Expected dbMatch");
      expect(dbMatch?.homeScore).toBe(3);
      expect(dbMatch?.awayScore).toBe(1);

      // Verify match players were created
      const matchPlayers = await db.query.MatchPlayers.findMany({
        where: (mp, { eq }) => eq(mp.matchId, result.id),
      });
      expect(matchPlayers).toHaveLength(4);

      // Verify ELO scores were updated
      const updatedSeasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });
      // Home team should have higher scores, away team lower
      const homePlayer1 = updatedSeasonPlayers.find((p) => p.id === seasonPlayers[0].id);
      const homePlayer2 = updatedSeasonPlayers.find((p) => p.id === seasonPlayers[1].id);
      expect(homePlayer1?.score).toBeGreaterThan(1200);
      expect(homePlayer2?.score).toBeGreaterThan(1200);
    });

    it("should throw FORBIDDEN if season does not support ELO", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, fixtureSeason.id),
      });

      const input = {
        leagueSlug: league.slug,
        seasonSlug: fixtureSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[1].id] as [string, ...string[]],
        homeScore: 3,
        awayScore: 1,
      };

      await expect(caller.match.createEloMatch(input)).rejects.toThrow(
        "This season does not support Elo matches",
      );
    });

    it("should throw FORBIDDEN if season is closed", async () => {
      // Close the season
      await db
        .update(schema.Seasons)
        .set({ closed: true })
        .where(eq(schema.Seasons.id, eloSeason.id));

      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });

      const input = {
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[1].id] as [string, ...string[]],
        homeScore: 3,
        awayScore: 1,
      };

      await expect(caller.match.createEloMatch(input)).rejects.toThrow("This season is closed");
    });
  });

  describe("createFixtureMatch", () => {
    it("should create a fixture match", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, fixtureSeason.id),
      });

      // Create a fixture
      const fixture = await createTestSeasonFixture(
        fixtureSeason.id,
        seasonPlayers[0].id,
        seasonPlayers[1].id,
        1,
        null,
      );

      const input = {
        leagueSlug: league.slug,
        seasonSlug: fixtureSeason.slug,
        seasonFixtureId: fixture.id,
        homeScore: 3,
        awayScore: 1,
      };

      const result = await caller.match.createFixtureMatch(input);

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result.homeScore).toBe(3);
      expect(result.awayScore).toBe(1);

      // Verify fixture was assigned
      const updatedFixture = await db.query.SeasonFixtures.findFirst({
        where: (fixtures, { eq }) => eq(fixtures.id, fixture.id),
      });
      expect(updatedFixture?.matchId).toBe(result.id);

      // Verify match players were created
      const matchPlayers = await db.query.MatchPlayers.findMany({
        where: (mp, { eq }) => eq(mp.matchId, result.id),
      });
      expect(matchPlayers).toHaveLength(2);

      // Verify scores were updated (3-1-0 scoring)
      const updatedPlayer1 = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[0].id),
      });
      const updatedPlayer2 = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[1].id),
      });
      expect(updatedPlayer1?.score).toBe(3); // Winner gets 3 points
      expect(updatedPlayer2?.score).toBe(0); // Loser gets 0 points
    });

    it("should throw FORBIDDEN if season does not support fixtures", async () => {
      const input = {
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        seasonFixtureId: "fixture-123",
        homeScore: 3,
        awayScore: 1,
      };

      await expect(caller.match.createFixtureMatch(input)).rejects.toThrow(
        "This season does not support fixture matches",
      );
    });

    it("should throw NOT_FOUND if fixture does not exist", async () => {
      const input = {
        leagueSlug: league.slug,
        seasonSlug: fixtureSeason.slug,
        seasonFixtureId: "non-existent",
        homeScore: 3,
        awayScore: 1,
      };

      await expect(caller.match.createFixtureMatch(input)).rejects.toThrow("Fixture not found");
    });

    it("should throw CONFLICT if fixture already has a match", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, fixtureSeason.id),
      });

      // Create a fixture first
      const fixture = await createTestSeasonFixture(
        fixtureSeason.id,
        seasonPlayers[0].id,
        seasonPlayers[1].id,
        1,
        null,
      );

      // Create a match for this fixture
      const firstMatchInput = {
        leagueSlug: league.slug,
        seasonSlug: fixtureSeason.slug,
        seasonFixtureId: fixture.id,
        homeScore: 3,
        awayScore: 1,
      };
      await caller.match.createFixtureMatch(firstMatchInput);

      // Try to create another match for the same fixture
      const input = {
        leagueSlug: league.slug,
        seasonSlug: fixtureSeason.slug,
        seasonFixtureId: fixture.id,
        homeScore: 2,
        awayScore: 2,
      };

      await expect(caller.match.createFixtureMatch(input)).rejects.toThrow(
        "Match already registered",
      );
    });
  });

  describe("getById", () => {
    it("should return match by ID", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });

      // Create a match
      const match = await caller.match.createEloMatch({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[1].id] as [string, ...string[]],
        homeScore: 3,
        awayScore: 1,
      });

      const result = await caller.match.getById({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        matchId: match.id,
      });

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result?.id).toBe(match.id);
      expect(result?.homeScore).toBe(3);
      expect(result?.awayScore).toBe(1);
    });

    it("should return null if match does not exist", async () => {
      const result = await caller.match.getById({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        matchId: "non-existent",
      });

      expect(result).toBeNull();
    });
  });

  describe("getLatest", () => {
    it("should return latest match in season", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });

      // Create multiple matches
      await caller.match.createEloMatch({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[1].id] as [string, ...string[]],
        homeScore: 3,
        awayScore: 1,
      });

      const latestMatch = await caller.match.createEloMatch({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[2].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[3].id] as [string, ...string[]],
        homeScore: 2,
        awayScore: 2,
      });

      const result = await caller.match.getLatest({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
      });

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result?.id).toBe(latestMatch.id);
    });

    it("should return null if no matches exist", async () => {
      const result = await caller.match.getLatest({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
      });

      expect(result).toBeNull();
    });
  });

  describe("getAll", () => {
    it("should return paginated matches in season", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });

      // Create multiple matches
      await caller.match.createEloMatch({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[1].id] as [string, ...string[]],
        homeScore: 3,
        awayScore: 1,
      });

      await caller.match.createEloMatch({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[2].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[3].id] as [string, ...string[]],
        homeScore: 2,
        awayScore: 2,
      });

      const result = await caller.match.getAll({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        page: 1,
        limit: 30,
      });

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result.matches).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
    });

    it("should use default pagination values", async () => {
      const result = await caller.match.getAll({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
      });

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result.page).toBe(1);
      expect(result.limit).toBe(30);
    });
  });

  describe("remove", () => {
    it("should delete match", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });

      // Create a match
      const match = await caller.match.createEloMatch({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[1].id] as [string, ...string[]],
        homeScore: 3,
        awayScore: 1,
      });

      const result = await caller.match.remove({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        matchId: match.id,
      });

      expect(result).toEqual({ success: true });

      // Verify match was deleted
      const deletedMatch = await db.query.Matches.findFirst({
        where: (matches, { eq }) => eq(matches.id, match.id),
      });
      expect(deletedMatch).toBeUndefined();

      // Verify scores were reverted
      const player1After = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[0].id),
      });
      const player2After = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[1].id),
      });
      expect(player1After?.score).toBe(1200); // Back to initial score
      expect(player2After?.score).toBe(1200);
    });
  });

  describe("access control", () => {
    it("should require authentication for all match operations", async () => {
      const unauthContext: TRPCContext = {
        headers: new Headers(),
        session: {
          id: "",
          userId: "",
          expiresAt: new Date(),
          token: "",
          ipAddress: "",
          userAgent: "",
          createdAt: new Date(),
          updatedAt: new Date(),
          // @ts-expect-error - intentionally missing user for test
          user: undefined,
        },
        db: createDb(),
      };

      const unauthCaller = createCaller(unauthContext);

      await expect(
        unauthCaller.match.getLatest({
          leagueSlug: league.slug,
          seasonSlug: eloSeason.slug,
        }),
      ).rejects.toThrow();
    });

    it("should require season access for match operations", async () => {
      const otherUser = await createTestUser({ name: "Other User" });
      const otherLeague = await createTestLeague(otherUser.id, { name: "Other League" });

      await expect(
        caller.match.getLatest({
          leagueSlug: otherLeague.slug,
          seasonSlug: "private-season",
        }),
      ).rejects.toThrow();
    });
  });

  describe("ELO calculation", () => {
    it("should correctly calculate ELO points for winner", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });

      const player1Before = seasonPlayers[0].score;
      const player2Before = seasonPlayers[1].score;

      await caller.match.createEloMatch({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[1].id] as [string, ...string[]],
        homeScore: 5,
        awayScore: 0,
      });

      const player1After = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[0].id),
      });
      const player2After = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[1].id),
      });

      expect(player1After?.score).toBeGreaterThan(player1Before);
      expect(player2After?.score).toBeLessThan(player2Before);
      expect(player1After?.score + player2After?.score).toBe(player1Before + player2Before);
    });

    it("should correctly calculate ELO points for draw", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, eloSeason.id),
      });

      const player1Before = seasonPlayers[0].score;
      const player2Before = seasonPlayers[1].score;

      await caller.match.createEloMatch({
        leagueSlug: league.slug,
        seasonSlug: eloSeason.slug,
        homeTeamSeasonPlayerIds: [seasonPlayers[0].id] as [string, ...string[]],
        awayTeamSeasonPlayerIds: [seasonPlayers[1].id] as [string, ...string[]],
        homeScore: 2,
        awayScore: 2,
      });

      const player1After = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[0].id),
      });
      const player2After = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[1].id),
      });

      // In a draw, both players' ratings should stay roughly the same
      expect(Math.abs(player1After?.score - player1Before)).toBeLessThan(5);
      expect(Math.abs(player2After?.score - player2Before)).toBeLessThan(5);
    });
  });

  describe("3-1-0 scoring", () => {
    it("should award 3 points for win in fixture match", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, fixtureSeason.id),
      });

      const fixture = await createTestSeasonFixture(
        fixtureSeason.id,
        seasonPlayers[0].id,
        seasonPlayers[1].id,
        1,
        null,
      );

      await caller.match.createFixtureMatch({
        leagueSlug: league.slug,
        seasonSlug: fixtureSeason.slug,
        seasonFixtureId: fixture.id,
        homeScore: 3,
        awayScore: 0,
      });

      const winner = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[0].id),
      });
      const loser = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[1].id),
      });

      expect(winner?.score).toBe(3);
      expect(loser?.score).toBe(0);
    });

    it("should award 1 point each for draw in fixture match", async () => {
      const seasonPlayers = await db.query.SeasonPlayers.findMany({
        where: (sp, { eq }) => eq(sp.seasonId, fixtureSeason.id),
      });

      const fixture = await createTestSeasonFixture(
        fixtureSeason.id,
        seasonPlayers[2].id,
        seasonPlayers[3].id,
        1,
        null,
      );

      await caller.match.createFixtureMatch({
        leagueSlug: league.slug,
        seasonSlug: fixtureSeason.slug,
        seasonFixtureId: fixture.id,
        homeScore: 1,
        awayScore: 1,
      });

      const player1 = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[2].id),
      });
      const player2 = await db.query.SeasonPlayers.findFirst({
        where: (sp, { eq }) => eq(sp.id, seasonPlayers[3].id),
      });

      expect(player1?.score).toBe(1);
      expect(player2?.score).toBe(1);
    });
  });
});
