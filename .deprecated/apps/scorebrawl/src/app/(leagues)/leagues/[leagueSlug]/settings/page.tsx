import { LeagueSettings } from "@/app/(leagues)/leagues/[leagueSlug]/settings/components/LeagueSettings";
import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";

export default async ({ params }: { params: Promise<{ leagueSlug: string }> }) => {
  const { leagueSlug } = await params;
  return (
    <>
      <BreadcrumbsHeader breadcrumbs={[{ name: "Settings" }]} />
      <LeagueSettings leagueSlug={leagueSlug} />
    </>
  );
};
