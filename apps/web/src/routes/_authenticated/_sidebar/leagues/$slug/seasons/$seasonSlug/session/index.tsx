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

	const { data: activeSession, isLoading } = useQuery(
		trpc.session.getActive.queryOptions({ seasonSlug })
	);

	useEffect(() => {
		if (isLoading) return;
		if (activeSession) {
			navigate({
				to: "/leagues/$slug/seasons/$seasonSlug/session/$sessionId",
				params: { slug, seasonSlug, sessionId: activeSession.id },
				replace: true,
			});
		} else {
			navigate({
				to: "/leagues/$slug/seasons/$seasonSlug",
				params: { slug, seasonSlug },
				search: { startSession: true },
				replace: true,
			});
		}
	}, [activeSession, isLoading, navigate, slug, seasonSlug]);

	return null;
}
