import { z } from "zod";

export const LeagueTeamInputDTO = z.object({
  teamId: z.string(),
  leagueSlug: z.string(),
  name: z.string().min(0, { message: "Name is required" }),
});
