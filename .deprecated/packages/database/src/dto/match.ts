import { z } from "zod";

export const EloMatchInputDTOSchema = z.object({
  leagueSlug: z.string().min(1),
  seasonSlug: z.string().min(1),
  homeTeamSeasonPlayerIds: z.string().array().nonempty(),
  awayTeamSeasonPlayerIds: z.string().array().nonempty(),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
});

export const FixtureMatchInputDTOSchema = z.object({
  leagueSlug: z.string().min(1),
  seasonSlug: z.string().min(1),
  seasonFixtureId: z.string().min(1),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
});

export const MatchDTO = z.object({
  id: z.string(),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
  homeTeamSeasonPlayerIds: z.string().array(),
  awayTeamSeasonPlayerIds: z.string().array(),
  createdAt: z.date(),
});

export const RemoveMatchDTO = z.object({
  leagueSlug: z.string(),
  seasonSlug: z.string(),
  matchId: z.string(),
});
