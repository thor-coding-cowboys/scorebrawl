import z from "zod";

const DEFAULT_LEAGUE_LOGO = "https://placehold.co/400x400/2563eb/ffffff?text=League";

export const LeagueCreateDTO = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  logoUrl: z.string().url().default(DEFAULT_LEAGUE_LOGO),
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
