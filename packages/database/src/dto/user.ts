import z from "zod";

export const UserDTO = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().optional(),
  defaultLeagueId: z.string().optional(),
});
