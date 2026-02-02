import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { LeaguePlayersTable } from "./components/leaguePlayersTable";

export default async ({ params }: { params: Promise<{ leagueSlug: string }> }) => {
  const { leagueSlug } = await params;
  return (
    <>
      <BreadcrumbsHeader breadcrumbs={[{ name: "Players" }]} />
      <div className="grid">
        <LeaguePlayersTable leagueSlug={leagueSlug} />
      </div>
    </>
  );
};
