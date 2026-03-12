import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchSessionForRoute } from "@/hooks/useSession";
import { AdminLeaguesPage } from "./-components/admin-leagues-page";

export const Route = createFileRoute("/_authenticated/admin/leagues/")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);

		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}

		return { session };
	},
});

function RouteComponent() {
	return <AdminLeaguesPage />;
}
