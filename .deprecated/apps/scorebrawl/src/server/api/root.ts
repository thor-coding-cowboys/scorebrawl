import { achievementRouter } from "@/server/api/routers/achievement-router";
import { avatarRouter } from "@/server/api/routers/avatar-router";
import { inviteRouter } from "@/server/api/routers/invite-router";
import { leaguePlayerRouter } from "@/server/api/routers/league-player-router";
import { leagueRouter } from "@/server/api/routers/league-router";
import { leagueTeamRouter } from "@/server/api/routers/league-team-router";
import { matchRouter } from "@/server/api/routers/match-router";
import { memberRouter } from "@/server/api/routers/member-router";
import { seasonPlayerRouter } from "@/server/api/routers/season-player-router";
import { seasonRouter } from "@/server/api/routers/season-router";
import { seasonTeamRouter } from "@/server/api/routers/season-team-router";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { userRouter } from "./routers/user-router";

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
