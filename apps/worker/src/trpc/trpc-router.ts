import { competitionPlayerRouter } from "./router/competition-player-router";
import { competitionRouter } from "./router/competition-router";
import { matchRouter } from "./router/match-router";
import { memberRouter } from "./router/member-router";
import { organizationRouter } from "./router/organization-router";
import { playerRouter } from "./router/player-router";
import { userAssetRouter } from "./router/user-assets-router";
import { teamRouter } from "./router/team-router";
import { createTRPCRouter } from "./trpc";

export const trpcRouter = createTRPCRouter({
	team: teamRouter,
	member: memberRouter,
	organization: organizationRouter,
	userAssets: userAssetRouter,
	competition: competitionRouter,
	player: playerRouter,
	match: matchRouter,
	competitionPlayer: competitionPlayerRouter,
});

export type TRPCRouter = typeof trpcRouter;
