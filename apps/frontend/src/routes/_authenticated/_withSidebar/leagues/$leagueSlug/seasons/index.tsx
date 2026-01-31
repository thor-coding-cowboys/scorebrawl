import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { AddSeasonButton } from "@/components/season/AddSeasonButton";
import { SeasonTable } from "@/components/season/season-table";
import { trpc } from "@/lib/trpc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/")({
  component: SeasonsPage,
});

function SeasonsPage() {
  const { leagueSlug } = Route.useParams();
  const { data: hasEditorAccess } = trpc.league.hasEditorAccess.useQuery({ leagueSlug });

  return (
    <>
      <BreadcrumbsHeader breadcrumbs={[{ name: "Seasons" }]}>
        {hasEditorAccess && <AddSeasonButton leagueSlug={leagueSlug} />}
      </BreadcrumbsHeader>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <SeasonTable leagueSlug={leagueSlug} showTopPlayerAndTeam={true} />
      </div>
    </>
  );
}
