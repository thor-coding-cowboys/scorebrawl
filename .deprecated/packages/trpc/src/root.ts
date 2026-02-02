import { achievementRouter } from "./routers/achievement-router";
import { avatarRouter } from "./routers/avatar-router";
import { inviteRouter } from "./routers/invite-router";
import { leaguePlayerRouter } from "./routers/league-player-router";
import { leagueRouter } from "./routers/league-router";
import { leagueTeamRouter } from "./routers/league-team-router";
import { matchRouter } from "./routers/match-router";
import { memberRouter } from "./routers/member-router";
import { seasonPlayerRouter } from "./routers/season-player-router";
import { seasonRouter } from "./routers/season-router";
import { seasonTeamRouter } from "./routers/season-team-router";
import { userRouter } from "./routers/user-router";
import { createCallerFactory, createTRPCRouter } from "./trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  achievement: achievementRouter,
  avatar: avatarRouter,
  invite: inviteRouter,
  league: leagueRouter,
  match: matchRouter,
  member: memberRouter,
  leaguePlayer: leaguePlayerRouter,
  leagueTeam: leagueTeamRouter,
  seasonPlayer: seasonPlayerRouter,
  season: seasonRouter,
  seasonTeam: seasonTeamRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
