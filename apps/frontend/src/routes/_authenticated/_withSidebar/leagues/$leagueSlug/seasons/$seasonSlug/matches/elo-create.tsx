import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { ClosedSeasonRedirect } from "@/components/match/ClosedSeasonRedirect";
import { MatchForm } from "@/components/match/MatchForm";
import { LatestMatches } from "@/components/season/LatestMatches";
import { StandingTabs } from "@/components/season/StandingTabs";
import { useSeason } from "@/context/season-context";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/$seasonSlug/matches/elo-create",
)({
  component: EloCreateMatchPage,
});

function EloCreateMatchPage() {
  const { leagueSlug, seasonSlug, season } = useSeason();

  if (season?.closed) {
    return <ClosedSeasonRedirect leagueSlug={leagueSlug} />;
  }

  if (!season) {
    return null;
  }

  return (
    <>
      <BreadcrumbsHeader
        breadcrumbs={[
          { name: "Seasons", href: `/leagues/${leagueSlug}/seasons` },
          { name: season.name, href: `/leagues/${leagueSlug}/seasons/${seasonSlug}` },
          { name: "Matches", href: `/leagues/${leagueSlug}/seasons/${seasonSlug}/matches` },
          { name: "Create" },
        ]}
      />
      <div className="grid gap-6">
        <MatchForm leagueSlug={leagueSlug} seasonSlug={seasonSlug} />
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <StandingTabs />
          <LatestMatches />
        </div>
      </div>
    </>
  );
}
