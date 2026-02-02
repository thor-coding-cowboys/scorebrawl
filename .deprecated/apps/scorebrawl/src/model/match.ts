import z from "zod";

export const MatchResultSymbolSchema = z.union([z.literal("W"), z.literal("D"), z.literal("L")]);
export type MatchResultSymbol = z.infer<typeof MatchResultSymbolSchema>;

export const MatchInput = z.object({
  leagueId: z.string().min(1),
  seasonId: z.string().min(1),
  homeTeamSeasonPlayerIds: z.string().array().nonempty(),
  awayTeamSeasonPlayerIds: z.string().array().nonempty(),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
  userId: z.string(),
});

export const Match = z.object({
  id: z.string(),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
  createdAt: z.date(),
  homeTeamSeasonPlayerIds: z.string().array(),
  awayTeamSeasonPlayerIds: z.string().array(),
});
