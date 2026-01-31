import { createDb } from "@scorebrawl/database/db";
import {
  LeagueMembers,
  LeaguePlayers,
  Leagues,
  SeasonFixtures,
  SeasonPlayers,
  Seasons,
  Sessions,
  Users,
} from "@scorebrawl/database/schema";
import { createId } from "@scorebrawl/utils/id";
import type { Session, User } from "better-auth/types";

// Create a shared test db instance
const testDb = createDb();

export const createTestUser = async (data: Partial<User> = {}): Promise<User> => {
  const user = {
    id: data.id || createId(),
    name: data.name || "Test User",
    email: data.email || `test-${createId()}@example.com`,
    emailVerified: data.emailVerified ?? false,
    image: data.image ?? null,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
  };

  await testDb.insert(Users).values(user);
  return user as User;
};

export const createTestSession = async (userId: string): Promise<Session> => {
  const session = {
    id: createId(),
    userId,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    token: `test-token-${createId()}`,
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(Sessions).values(session);
  return session as Session;
};

export const createTestLeague = async (
  createdBy: string,
  data: Partial<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string;
    archived: boolean;
  }> = {},
) => {
  const leagueId = data.id || createId();
  const league = {
    id: leagueId,
    name: data.name || "Test League",
    slug: data.slug || `test-league-${createId()}`,
    logoUrl: data.logoUrl || null,
    archived: data.archived ?? false,
    createdBy,
    updatedBy: createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(Leagues).values(league);

  // Add creator as owner
  await testDb.insert(LeagueMembers).values({
    id: createId(),
    leagueId,
    userId: createdBy,
    role: "owner",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return league;
};

export const createTestLeagueMember = async (
  leagueId: string,
  userId: string,
  role: "owner" | "editor" | "member" | "viewer" = "member",
) => {
  const member = {
    id: createId(),
    leagueId,
    userId,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(LeagueMembers).values(member);
  return member;
};

export const createTestLeaguePlayer = async (leagueId: string, userId: string) => {
  const playerId = createId();
  const player = {
    id: playerId,
    leagueId,
    userId,
    disabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(LeaguePlayers).values(player);
  return player;
};

export const createTestLeaguePlayers = async (leagueId: string, count = 2) => {
  const players: Array<Awaited<ReturnType<typeof createTestLeaguePlayer>> & { user: User }> = [];
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({ name: `Player ${i + 1}` });
    const player = await createTestLeaguePlayer(leagueId, user.id);
    players.push({ ...player, user });
  }
  return players;
};

export const createTestSeason = async (
  leagueId: string,
  createdBy: string,
  data: Partial<Record<string, unknown>> = {},
) => {
  const seasonId = createId();
  const season = {
    id: seasonId,
    leagueId,
    name: data.name || "Test Season",
    slug: data.slug || `test-season-${createId()}`,
    scoreType: data.scoreType || "elo",
    initialScore: data.initialScore ?? 1200,
    kFactor: data.kFactor ?? 32,
    startDate: data.startDate || new Date(),
    endDate: data.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    rounds: data.rounds || null,
    closed: data.closed ?? false,
    createdBy,
    updatedBy: createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  };

  await testDb.insert(Seasons).values(season);
  return season;
};

export const createTestSeasonPlayer = async (
  seasonId: string,
  leaguePlayerId: string,
  initialScore = 1200,
) => {
  const seasonPlayerId = createId();
  const seasonPlayer = {
    id: seasonPlayerId,
    seasonId,
    leaguePlayerId,
    score: initialScore,
    disabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(SeasonPlayers).values(seasonPlayer);
  return seasonPlayer;
};

export const createTestSeasonFixture = async (
  seasonId: string,
  homePlayerId: string,
  awayPlayerId: string,
  round = 1,
  matchId: string | null = null,
) => {
  const fixtureId = createId();
  const fixture = {
    id: fixtureId,
    seasonId,
    homePlayerId,
    awayPlayerId,
    round,
    matchId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(SeasonFixtures).values(fixture);
  return fixture;
};
