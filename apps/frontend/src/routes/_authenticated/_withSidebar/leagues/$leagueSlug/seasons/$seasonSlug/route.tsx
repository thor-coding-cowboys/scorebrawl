import { SeasonProvider } from "@/context/season-context";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/$seasonSlug",
)({
  component: SeasonLayout,
});

function SeasonLayout() {
  const { leagueSlug, seasonSlug } = Route.useParams();

  return (
    <SeasonProvider leagueSlug={leagueSlug} seasonSlug={seasonSlug}>
      <Outlet />
    </SeasonProvider>
  );
}
