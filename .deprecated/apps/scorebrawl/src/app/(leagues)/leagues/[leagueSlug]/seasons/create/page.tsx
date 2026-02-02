import { findLeagueBySlugWithUserRole } from "@/actions/league";
import { ToastMessageNoOngoing } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/create/components/toastMessageNoOngoing";
import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { SeasonForm310 } from "@/components/season/season-form-310";
import { SeasonFormElo } from "@/components/season/season-form-elo";
import { SeasonTable } from "@/components/season/season-table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScoreType } from "@/model";
import { editorRoles } from "@/utils/permission-util";
import type { Metadata, ResolvingMetadata } from "next";
import { RedirectType, redirect } from "next/navigation";

export async function generateMetadata(
  { params }: { params: Promise<{ leagueSlug: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { leagueSlug } = await params;
  const league = { name: "" };
  try {
    const leagueBySlug = await findLeagueBySlugWithUserRole(leagueSlug);
    league.name = leagueBySlug?.name ?? "Unknown";
  } catch (_e) {
    // ignore
  }

  return {
    title: `${league.name} | Create Season`,
  };
}

export default async function ({
  params,
  searchParams,
}: { params: Promise<{ leagueSlug: string }>; searchParams: Promise<{ scoreType: ScoreType }> }) {
  const { leagueSlug } = await params;

  const league =
    (await findLeagueBySlugWithUserRole(leagueSlug)) ??
    redirect("/?errorCode=LEAGUE_NOT_FOUND", RedirectType.replace);

  const hasEditorAccess = editorRoles.includes(league.role);
  if (!hasEditorAccess) {
    redirect("/?errorCode=LEAGUE_PERMISSION", RedirectType.replace);
  }

  const scoreType = (await searchParams).scoreType ?? "elo";
  return (
    <>
      <BreadcrumbsHeader
        breadcrumbs={[
          { name: "Seasons", href: `/leagues/${leagueSlug}/seasons` },
          { name: "Create" },
        ]}
      />
      <div className="flex flex-col gap-6 md:flex-row">
        <ToastMessageNoOngoing leagueSlug={leagueSlug} />
        <Tabs defaultValue={scoreType} className="flex-1 flex flex-col">
          <TabsList className="flex">
            <TabsTrigger className="flex-1" value="elo">
              Elo
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="3-1-0">
              3-1-0
            </TabsTrigger>
          </TabsList>
          <TabsContent value="elo">
            <div className="flex flex-col gap-2 h-svh sm:h-auto">
              <SeasonFormElo league={league} />
            </div>
          </TabsContent>
          <TabsContent value="3-1-0">
            <div className="flex flex-col gap-2 h-svh sm:h-auto">
              <SeasonForm310 league={league} />
            </div>
          </TabsContent>
        </Tabs>
        <div className={"flex-1"}>
          <div className="pb-3">
            <Label className="text-sm font-medium">All seasons</Label>
          </div>
          <div className="rounded-md border grid">
            <SeasonTable leagueSlug={league.slug} />
          </div>
        </div>
      </div>
    </>
  );
}
