"use server";

import { api } from "@/trpc/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const clearLastVisitedLeague = async () => {
  (await cookies()).delete("last-visited-league");
};

export const resetLastVisitedLeague = async ({
  leagueSlug,
}: {
  leagueSlug: string;
}) => {
  (await cookies()).set("last-visited-league", leagueSlug, { path: "/" });
};

export const redirectToLeagueOrOnboarding = async () => {
  const me = await api.user.me();
  const leagues = await api.league.getAll({});
  const lastVisitedLeague = (await cookies()).get("last-visited-league");
  if (lastVisitedLeague && leagues.find((l) => l.slug === lastVisitedLeague.value)) {
    redirect(`/leagues/${lastVisitedLeague.value}`);
  } else {
    const defaultLeagueSlug = leagues.find((l) => l.id === me.defaultLeagueId)?.slug;
    if (defaultLeagueSlug) {
      redirect(`/leagues/${defaultLeagueSlug}`);
    } else if (leagues.length > 0 && leagues[0]?.slug) {
      redirect(`/leagues/${leagues[0].slug}`);
    } else {
      redirect("/onboarding");
    }
  }
};
