import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchSessionForRoute } from "@/hooks/useSession";
import { AdminUsersPage } from "./-components/admin-users-page";

export const Route = createFileRoute("/_authenticated/admin/users/")({
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
	return <AdminUsersPage />;
}
