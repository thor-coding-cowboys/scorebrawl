import z from "zod";

export const LeagueCreate = z.object({
  userId: z.string(),
  name: z.string().min(0),
  logoUrl: z.string().url(),
});

export const LeagueEdit = z.object({
  id: z.string(),
  name: z.string().optional(),
  logoUrl: z.string().url().optional(),
  userId: z.string(),
});
