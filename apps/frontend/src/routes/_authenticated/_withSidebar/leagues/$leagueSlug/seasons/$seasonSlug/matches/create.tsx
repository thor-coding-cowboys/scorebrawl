import { ClosedSeasonRedirect } from "@/components/match/ClosedSeasonRedirect";
import { MatchForm } from "@/components/match/MatchForm";
import { trpc } from "@/lib/trpc";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/$seasonSlug/matches/create",
)({
  component: CreateMatchPage,
});

function CreateMatchPage() {
  const { leagueSlug, seasonSlug } = Route.useParams();
  const { data: season } = trpc.season.getBySlug.useQuery({ leagueSlug, seasonSlug });

  if (season?.closed) {
    return <ClosedSeasonRedirect leagueSlug={leagueSlug} />;
  }

  return (
    <div className="grid gap-3">
      <MatchForm leagueSlug={leagueSlug} seasonSlug={seasonSlug} />
    </div>
  );
}
