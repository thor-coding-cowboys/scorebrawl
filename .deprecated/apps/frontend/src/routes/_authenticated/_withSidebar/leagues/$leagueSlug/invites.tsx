import { InviteDialog } from "@/components/league/InviteDialog";
import { InviteTable } from "@/components/league/InviteTable";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/$leagueSlug/invites")({
  component: InvitesPage,
});

function InvitesPage() {
  const { leagueSlug } = Route.useParams();

  return (
    <>
      <div className="flex justify-end mb-4">
        <InviteDialog leagueSlug={leagueSlug} />
      </div>
      <div className={"grid"}>
        <InviteTable leagueSlug={leagueSlug} />
      </div>
    </>
  );
}
