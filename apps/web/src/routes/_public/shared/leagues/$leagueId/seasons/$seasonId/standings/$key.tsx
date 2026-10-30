import { createFileRoute } from "@tanstack/react-router";
import { SharedStandingsPage } from "./-components/shared-standings-page";

export const Route = createFileRoute(
	"/_public/shared/leagues/$leagueId/seasons/$seasonId/standings/$key"
)({
	component: RouteComponent,
});

function RouteComponent() {
	const { key } = Route.useParams();
	return <SharedStandingsPage shareKey={key} />;
}
