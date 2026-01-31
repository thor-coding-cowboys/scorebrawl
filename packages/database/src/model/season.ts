import z from "zod";

export const ScoreTypeSchema = z.union([
  z.literal("elo"),
  z.literal("3-1-0"),
  z.literal("elo-individual-vs-team"),
]);
export type ScoreType = z.infer<typeof ScoreTypeSchema>;

export const EloTypeEnumSchema = z.enum(["team vs team"]);

export const BaseSeasonCreateSchema = z.object({
  name: z.string().min(0, "Name is required"),
  userId: z.string(),
  leagueId: z.string(),
  startDate: z.date(),
  endDate: z.date().optional(),
});
export const EloSeasonCreateSchema = z
  .object({
    scoreType: z.literal("elo"),
    initialScore: z.number().int().min(0),
    kFactor: z.number().int().min(10).max(50),
  })
  .merge(BaseSeasonCreateSchema);

export const ThreeOneNilSeasonCreateSchema = z
  .object({
    scoreType: z.literal("3-1-0"),
    roundsPerPlayer: z.number().int(),
  })
  .merge(BaseSeasonCreateSchema);

export const SeasonCreateSchema = z.discriminatedUnion("scoreType", [
  EloSeasonCreateSchema,
  ThreeOneNilSeasonCreateSchema,
]);

export const SeasonEditSchema = z.object({
  seasonId: z.string(),
  userId: z.string(),
  name: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  initialScore: z.number().optional(),
  scoreType: ScoreTypeSchema.optional(),
  kFactor: z.number().optional(),
});
