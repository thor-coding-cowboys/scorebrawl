import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/summary"
)({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/leagues/$slug/seasons/$seasonSlug/session/$sessionId",
			params: {
				slug: params.slug,
				seasonSlug: params.seasonSlug,
				sessionId: params.sessionId,
			},
			replace: true,
		});
	},
});
