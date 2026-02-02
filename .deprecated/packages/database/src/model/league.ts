import z from "zod";

const DEFAULT_LEAGUE_LOGO = "https://placehold.co/400x400/2563eb/ffffff?text=League";

export const LeagueCreate = z.object({
  userId: z.string(),
  name: z.string().min(1),
  logoUrl: z.string().url().default(DEFAULT_LEAGUE_LOGO),
});

export const LeagueEdit = z.object({
  id: z.string(),
  name: z.string().optional(),
  logoUrl: z.string().url().optional(),
  userId: z.string(),
});
