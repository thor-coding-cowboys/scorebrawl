import { createFileRoute, Outlet, redirect, Link, useMatchRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSessionForRoute, useSession } from "@/hooks/useSession";
import { useTRPC } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon } from "@hugeicons/core-free-icons";
import { useSeasonSSE } from "@/hooks/use-season-sse";
import type { SessionEventDetail } from "@/lib/event-types";

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
	const { slug, seasonSlug } = Route.useParams();
	const queryClient = useQueryClient();
	const trpc = useTRPC();
	const matchRoute = useMatchRoute();

	const isSessionRoute = matchRoute({
		to: "/leagues/$slug/seasons/$seasonSlug/session/$sessionId",
		fuzzy: true,
	});

	const { data: activeSession } = useQuery(trpc.session.getActive.queryOptions({ seasonSlug }));

	const { data: season } = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));
	const { data: authSession } = useSession();

	useSeasonSSE({
		leagueSlug: slug,
		seasonSlug,
		seasonId: season?.id ?? "",
		currentUserId: authSession?.user.id,
		enabled: !!season?.id,
	});

	useEffect(() => {
		const handler = (e: CustomEvent<SessionEventDetail>) => {
			const detail = e.detail;
			if (detail.type === "session:start" || detail.type === "session:end") {
				void queryClient.invalidateQueries(trpc.session.getActive.queryFilter({ seasonSlug }));
			}
		};
		window.addEventListener("session-event", handler);
		return () => window.removeEventListener("session-event", handler);
	}, [seasonSlug, queryClient, trpc]);

	const playerCount = Array.isArray(activeSession?.players) ? activeSession.players.length : 0;

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{activeSession && !isSessionRoute && (
				<div className="border-b bg-amber-500/10 border-amber-500/20 px-4 py-2 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 text-sm">
						<div className="size-2 rounded-full bg-amber-500 animate-pulse" />
						<span className="font-medium text-amber-700 dark:text-amber-400">
							Session in progress
						</span>
						{playerCount > 0 && (
							<span className="text-amber-600/80 dark:text-amber-500/80 text-xs">
								· {playerCount} player{playerCount !== 1 ? "s" : ""}
							</span>
						)}
					</div>
					<Button
						size="sm"
						variant="outline"
						className="gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
						render={
							<Link
								to="/leagues/$slug/seasons/$seasonSlug/session/$sessionId"
								params={{ slug, seasonSlug, sessionId: activeSession.id }}
							/>
						}
					>
						<HugeiconsIcon icon={PlayIcon} className="size-3.5" />
						Go to Session
					</Button>
				</div>
			)}
			<Outlet />
		</div>
	);
}
