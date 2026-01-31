import z from "zod";

export const LeagueCreateDTO = z.object({
  name: z.string().min(0, { message: "Name is required" }),
  logoUrl: z.string().url(),
});

export const LeagueEditDTO = z
  .object({
    leagueSlug: z.string(),
    name: z.string().optional(),
    logoUrl: z.string().url().optional(),
  })
  .refine((data) => data.name !== undefined || data.logoUrl !== undefined, {
    message: "At least one of name or logoUrl must be provided",
    path: ["name", "logoUrl"],
  });
