import { ScoreTypeSchema } from "@/model";
import { z } from "zod";

export const BaseSeasonCreateDTOSchema = z.object({
  name: z.string().min(0, "Name is required"),
  leagueSlug: z.string(),
  startDate: z.date().optional().default(new Date()),
  endDate: z.date().optional(),
});
export const EloSeasonCreateDTOSchema = z
  .object({
    scoreType: z.literal("elo"),
    initialScore: z.coerce.number().int().min(0).default(1200),
    kFactor: z.coerce.number().int().min(10).max(50).optional().default(32),
  })
  .merge(BaseSeasonCreateDTOSchema);

export const ThreeOneNilSeasonCreateDTOSchema = z
  .object({
    scoreType: z.literal("3-1-0"),
    roundsPerPlayer: z.coerce
      .number()
      .int()
      .min(1)
      .max(365)
      .default(1)
      .describe("Rounds per player"),
  })
  .merge(BaseSeasonCreateDTOSchema);

export const SeasonCreateDTOSchema = z.discriminatedUnion("scoreType", [
  EloSeasonCreateDTOSchema,
  ThreeOneNilSeasonCreateDTOSchema,
]);

export const SeasonEditDTOSchema = z
  .object({
    leagueSlug: z.string(),
    seasonSlug: z.string(),
    name: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    initialScore: z.number().optional(),
    scoreType: ScoreTypeSchema.optional(),
    kFactor: z.number().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.initialScore !== undefined ||
      data.scoreType !== undefined ||
      data.kFactor !== undefined,
    {
      message: "At least one of startDate, endDate, initialScore, or kFactor must be provided",
      path: ["name", "startDate", "endDate", "initialScore", "scoreType", "kFactor"], // This will mark all these fields as the source of the error
    },
  );
