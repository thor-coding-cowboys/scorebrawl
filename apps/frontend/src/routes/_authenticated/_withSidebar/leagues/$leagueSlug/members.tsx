import { LeagueMemberTable } from "@/components/league/MemberTable";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/$leagueSlug/members")({
  component: MembersPage,
});

function MembersPage() {
  const { leagueSlug } = Route.useParams();

  return <LeagueMemberTable leagueSlug={leagueSlug} />;
}
