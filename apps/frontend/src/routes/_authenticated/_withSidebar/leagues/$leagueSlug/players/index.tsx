import { LeaguePlayersTable } from "@/components/league/leaguePlayersTable";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/$leagueSlug/players/")({
  component: PlayersPage,
});

function PlayersPage() {
  const { leagueSlug } = Route.useParams();

  return (
    <div className="grid">
      <LeaguePlayersTable leagueSlug={leagueSlug} />
    </div>
  );
}
