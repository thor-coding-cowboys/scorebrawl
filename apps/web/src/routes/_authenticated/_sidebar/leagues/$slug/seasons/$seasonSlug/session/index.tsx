import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/"
)({
	component: SessionIndexPage,
});

function SessionIndexPage() {
	const { slug, seasonSlug } = Route.useParams();
	const navigate = useNavigate();
	const trpc = useTRPC();

	const { data: activeSession, isPending: isActivePending } = useQuery(
		trpc.session.getActive.queryOptions({ seasonSlug })
	);

	const { data: recentSessions, isPending: isRecentPending } = useQuery({
		...trpc.session.listEnded.queryOptions({ seasonSlug, limit: 1 }),
		enabled: !isActivePending && !activeSession,
	});

	useEffect(() => {
		if (isActivePending) return;
		const sessionId = activeSession?.id;
		if (!sessionId && isRecentPending) return;

		const latestSessionId = sessionId ?? recentSessions?.[0]?.id;
		if (!latestSessionId) {
			navigate({
				to: "/leagues/$slug/seasons/$seasonSlug",
				params: { slug, seasonSlug },
				search: { startSession: true },
				replace: true,
			});
			return;
		}

		navigate({
			to: "/leagues/$slug/seasons/$seasonSlug/session/$sessionId",
			params: { slug, seasonSlug, sessionId: latestSessionId },
			replace: true,
		});
	}, [activeSession, isActivePending, isRecentPending, recentSessions, navigate, slug, seasonSlug]);

	return null;
}
