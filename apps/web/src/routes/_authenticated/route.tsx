import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const { data: session } = await authClient.getSession();

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
