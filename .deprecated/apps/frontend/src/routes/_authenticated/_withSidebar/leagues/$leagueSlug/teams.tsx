import { trpc } from "@/lib/trpc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/$leagueSlug/teams")({
  component: TeamsPage,
});

function TeamsPage() {
  const { leagueSlug } = Route.useParams();
  const { data: teams, isLoading } = trpc.leagueTeam.getAll.useQuery({ leagueSlug });

  if (isLoading) return <div>Loading teams...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Teams</h1>
      <div className="rounded-lg border">
        {teams?.map((team) => (
          <div key={team.id} className="p-4 border-b last:border-0">
            {team.name}
          </div>
        ))}
      </div>
    </div>
  );
}
