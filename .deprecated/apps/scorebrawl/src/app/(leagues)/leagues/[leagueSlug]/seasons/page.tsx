import { AddSeasonButton } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/components/AddSeasonButton";
import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { SeasonTable } from "@/components/season/season-table";
import { api } from "@/trpc/server";

export default async ({ params }: { params: Promise<{ leagueSlug: string }> }) => {
  const { leagueSlug } = await params;
  const hasEditorAccess = await api.league.hasEditorAccess({ leagueSlug });
  return (
    <>
      <BreadcrumbsHeader breadcrumbs={[{ name: "Seasons" }]}>
        {hasEditorAccess && <AddSeasonButton leagueSlug={leagueSlug} />}
      </BreadcrumbsHeader>
      <div className="grid pt-4">
        <SeasonTable leagueSlug={leagueSlug} showTopPlayerAndTeam={true} />
      </div>
    </>
  );
};
