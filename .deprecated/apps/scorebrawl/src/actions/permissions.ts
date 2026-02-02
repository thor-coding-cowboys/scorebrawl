"use server";
import type { LeagueMemberRole } from "@/dto";
import { redirect } from "next/navigation";
import type { z } from "zod";

type LeagueWithUserRole = {
  id: string;
  slug: string;
  role: "viewer" | "member" | "editor" | "owner";
};

export const validateMembership = async ({
  leagueWithMembership,
  allowedRoles,
}: {
  leagueWithMembership?: LeagueWithUserRole;
  allowedRoles: z.infer<typeof LeagueMemberRole>[];
}) => {
  if (!leagueWithMembership) {
    redirect("/?errorCode=LEAGUE_NOT_FOUND");
  }
  if (!allowedRoles.includes(leagueWithMembership.role)) {
    redirect(`/leagues/${leagueWithMembership.slug}/?errorCode=LEAGUE_PERMISSION`);
  }
};
