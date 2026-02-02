import { findLeagueBySlugWithUserRole } from "@/actions/league";
import { validateMembership } from "@/actions/permissions";
import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { RedirectType, redirect } from "next/navigation";
import { InviteDialog } from "./components/InviteDialog";
import { InviteTable } from "./components/InviteTable";

export default async ({ params }: { params: Promise<{ leagueSlug: string }> }) => {
  const { leagueSlug } = await params;
  const leagueWithMembership =
    (await findLeagueBySlugWithUserRole(leagueSlug)) ??
    redirect("/?errorCode=LEAGUE_NOT_FOUND", RedirectType.replace);
  await validateMembership({ leagueWithMembership, allowedRoles: ["owner", "editor"] });
  return (
    <>
      <BreadcrumbsHeader breadcrumbs={[{ name: "Invites" }]}>
        <InviteDialog leagueSlug={leagueSlug} />
      </BreadcrumbsHeader>
      <div className={"grid"}>
        <InviteTable leagueSlug={leagueSlug} />
      </div>
    </>
  );
};
