import { startOfDay } from "date-fns";
import z from "zod";

export const LeagueMemberRole = z.enum(["viewer", "member", "editor", "owner"]);
export const InviteInputDTO = z.object({
  leagueSlug: z.string(),
  role: LeagueMemberRole,
  expiresAt: z.date().min(startOfDay(new Date())).optional(),
});
