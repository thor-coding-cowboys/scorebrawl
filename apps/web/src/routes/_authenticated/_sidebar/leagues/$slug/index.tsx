import { createFileRoute, redirect } from "@tanstack/react-router";
import { trpcClient } from "@/lib/trpc";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/")({
	component: LeagueIndexPage,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
	beforeLoad: async ({ params, location }) => {
		// If already navigating to a specific season or seasons list, don't redirect
		if (location.pathname.includes(`/leagues/${params.slug}/seasons`)) {
			return;
		}

		// Check for active season
		const activeSeason = await trpcClient.season.findActive.query();

		if (activeSeason) {
			// Redirect to active season
			throw redirect({
				to: "/leagues/$slug/seasons/$seasonSlug",
				params: { slug: params.slug, seasonSlug: activeSeason.slug },
			});
		} else {
			// No active season, redirect to seasons list
			throw redirect({
				to: "/leagues/$slug/seasons",
				params: { slug: params.slug },
			});
		}
	},
});

function LeagueIndexPage() {
	// This component never renders due to the redirect
	return null;
}
