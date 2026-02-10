import { achievementRouter } from "./router/achievement-router";
import { seasonPlayerRouter } from "./router/season-player-router";
import { seasonRouter } from "./router/season-router";
import { matchRouter } from "./router/match-router";
import { memberRouter } from "./router/member-router";
import { leagueRouter } from "./router/league-router";
import { playerRouter } from "./router/player-router";
import { userRouter } from "./router/user-router";
import { organizationRouter } from "./router/organization-router";
import { seasonTeamRouter } from "./router/season-team-router";
import { leagueTeamRouter } from "./router/league-team-router";
import { createTRPCRouter } from "./trpc";

export const trpcRouter = createTRPCRouter({
	achievement: achievementRouter,
	leagueTeam: leagueTeamRouter,
	member: memberRouter,
	league: leagueRouter,
	user: userRouter,
	organization: organizationRouter,
	season: seasonRouter,
	player: playerRouter,
	match: matchRouter,
	seasonPlayer: seasonPlayerRouter,
	seasonTeam: seasonTeamRouter,
});

export type TRPCRouter = typeof trpcRouter;
