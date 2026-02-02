import { z } from "zod";
import { UserDTO } from "./user";

export const LeaguePlayerDTO = z.object({
  leaguePlayerId: z.string(),
  disabled: z.boolean(),
  joinedAt: z.date(),
  user: UserDTO,
});
