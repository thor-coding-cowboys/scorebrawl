import { z } from "zod";

export const LeagueTeamInput = z.object({
  teamId: z.string(),
  leagueSlug: z.string(),
  name: z.string(),
  isEditor: z.boolean(),
  userId: z.string(),
});
