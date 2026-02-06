import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchSessionForRoute } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug")({
	component: SeasonLayout,
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);
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
