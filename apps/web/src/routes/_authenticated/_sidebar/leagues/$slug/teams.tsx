import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/teams")({
	component: TeamsLayout,
});

function TeamsLayout() {
	return <Outlet />;
}
