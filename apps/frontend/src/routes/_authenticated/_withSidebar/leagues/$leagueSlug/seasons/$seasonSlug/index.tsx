import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { DashboardCards } from "@/components/season/DashboardCards";
import { Fixtures } from "@/components/season/Fixtures";
import { LatestMatches } from "@/components/season/LatestMatches";
import { OverviewCard } from "@/components/season/OverviewCard";
import { PointProgression } from "@/components/season/PointProgression";
import { StandingTabs } from "@/components/season/StandingTabs";
import { AddMatchButton } from "@/components/season/actions/addMatchButton";
import { useSeason } from "@/context/season-context";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/$seasonSlug/",
)({
  component: SeasonDashboard,
});

function SeasonDashboard() {
  const { season, leagueSlug } = useSeason();
  const isEloSeason = season.scoreType === "elo";

  return (
    <>
      <BreadcrumbsHeader
        breadcrumbs={[
          { name: "Seasons", href: `/leagues/${leagueSlug}/seasons` },
          { name: season.name },
        ]}
      >
        {isEloSeason && <AddMatchButton />}
      </BreadcrumbsHeader>
      <div className="grid gap-6">
        <DashboardCards />
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div className="grid gap-6">
              <StandingTabs />
            </div>
            <div className="grid gap-6">
              <LatestMatches />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid gap-6">
              {isEloSeason && (
                <OverviewCard title={"Point Progression"}>
                  <PointProgression />
                </OverviewCard>
              )}
              {!isEloSeason && (
                <OverviewCard title={"Fixtures"}>
                  <Fixtures />
                </OverviewCard>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
