import z from "zod";
import { User } from "./user";

export const LeaguePlayer = z.object({
  leaguePlayerId: z.string(),
  disabled: z.boolean(),
  joinedAt: z.date(),
  user: User,
});
