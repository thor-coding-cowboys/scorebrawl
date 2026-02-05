import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug")({
	component: SeasonLayout,
	beforeLoad: async () => {
		const { data: session } = await authClient.getSession();
		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}
	},
	loader: async ({ params }) => {
		return { slug: params.slug, seasonSlug: params.seasonSlug };
	},
});

function SeasonLayout() {
	return <Outlet />;
}
