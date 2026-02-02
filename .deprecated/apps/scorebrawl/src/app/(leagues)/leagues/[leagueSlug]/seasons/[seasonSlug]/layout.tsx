import { findLeagueBySlugWithUserRole } from "@/actions/league";
import { findSeasonBySlug } from "@/actions/season";
import { SeasonProvider } from "@/context/season-context";
import type { ReactNode } from "react";

export const generateMetadata = async ({
  params,
}: { params: Promise<{ leagueSlug: string; seasonSlug: string }> }) => {
  const league = { name: "" };
  const season = { name: "" };
  const { leagueSlug, seasonSlug } = await params;
  try {
    const leagueBySlug = await findLeagueBySlugWithUserRole(leagueSlug);
    league.name = leagueBySlug?.name ?? "Unknown";
    const seasonBySlug = await findSeasonBySlug(leagueSlug, seasonSlug);

    league.name = leagueBySlug?.name ?? "Unknown";
    season.name = seasonBySlug?.name ?? "Unknown";
  } catch (_e) {
    // ignore
  }

  return {
    title: `${league.name} | Seasons | ${season.name}`,
  };
};

export default async function Layout({
  children,
  params,
}: { children: ReactNode; params: Promise<{ leagueSlug: string; seasonSlug: string }> }) {
  const { leagueSlug, seasonSlug } = await params;
  return (
    <SeasonProvider leagueSlug={leagueSlug} seasonSlug={seasonSlug}>
      {children}
    </SeasonProvider>
  );
}
