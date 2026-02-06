import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchSessionForRoute } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);

		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}

		return { session };
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
