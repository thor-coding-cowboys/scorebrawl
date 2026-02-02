import { LeagueTeamsTable } from "@/app/(leagues)/leagues/[leagueSlug]/players/components/leagueTeamsTable";
import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";

export default async ({ params }: { params: Promise<{ leagueSlug: string }> }) => {
  const { leagueSlug } = await params;
  return (
    <>
      <BreadcrumbsHeader breadcrumbs={[{ name: "Teams" }]} />

      <LeagueTeamsTable leagueSlug={leagueSlug} />
    </>
  );
};
