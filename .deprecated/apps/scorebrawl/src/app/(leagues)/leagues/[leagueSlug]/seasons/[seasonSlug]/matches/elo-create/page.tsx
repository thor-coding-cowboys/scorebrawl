import { findSeasonBySlug } from "@/actions/season";
import { StandingTabs } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/StandingTabs";
import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { ClosedSeasonRedirect } from "./components/ClosedSeasonRedirect";
import { MatchForm } from "./components/MatchForm";

type PageParams = { params: Promise<{ leagueSlug: string; seasonSlug: string }> };

export default async ({ params }: PageParams) => {
  const { leagueSlug, seasonSlug } = await params;
  const season = await findSeasonBySlug(leagueSlug, seasonSlug);

  if (season.closed) {
    return <ClosedSeasonRedirect leagueSlug={leagueSlug} />;
  }
  return (
    <div className="grid gap-3">
      <BreadcrumbsHeader
        breadcrumbs={[
          { name: "Seasons", href: `/leagues/${leagueSlug}/seasons` },
          { name: season.name, href: `/leagues/${leagueSlug}/seasons/${seasonSlug}` },
          { name: "Matches", href: `/leagues/${leagueSlug}/seasons/${seasonSlug}/matches` },
          { name: "Create" },
        ]}
      />
      <MatchForm />
      <StandingTabs />
    </div>
  );
};
