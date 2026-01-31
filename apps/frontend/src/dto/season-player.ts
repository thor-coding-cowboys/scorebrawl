import { PlayerFormSchema } from "@/model";
import { z } from "zod";
import { UserDTO } from "./user";

export const SeasonPlayerDTO = z.object({
  seasonPlayerId: z.string(),
  leaguePlayerId: z.string(),
  score: z.number(),
  user: UserDTO,
});

export const SeasonPlayerStandingDTO = z
  .object({
    matchCount: z.number(),
    winCount: z.number(),
    lossCount: z.number(),
    drawCount: z.number(),
    form: PlayerFormSchema,
    pointDiff: z.number().optional(),
  })
  .merge(SeasonPlayerDTO);
