import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/components/landing";

export const Route = createFileRoute("/_public/home")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Landing />;
}
