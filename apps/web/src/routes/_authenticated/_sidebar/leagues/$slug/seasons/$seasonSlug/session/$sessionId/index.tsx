import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpcClient, type AnyTRPC } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { truncateSlug } from "@/lib/utils";
import { toast } from "sonner";
import type { SessionEventDetail } from "@/lib/event-types";
import {
	SessionDashboardCards,
	type GameSession,
} from "./-components";
import { WinnerStaysSession } from "./-components/winner-stays/winner-stays-session";
import { ManualSession } from "./-components/manual/manual-session";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/"
)({
	component: SessionLivePage,
});

function exhaustiveCheck(value: never): never {
	throw new Error(`Unhandled mode: ${value}`);
}

function LoadingState() {
	return (
		<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
			Loading session...
		</div>
	);
}

function LegacySessionFallback({ session }: { session: GameSession }) {
	const { slug, seasonSlug } = Route.useParams();
	const navigate = useNavigate();

	const endSession = () => {
		navigate({
			to: "/leagues/$slug/seasons/$seasonSlug",
			params: { slug, seasonSlug },
		});
	};

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Seasons", href: `/leagues/${slug}/seasons` },
					{ name: truncateSlug(seasonSlug), href: `/leagues/${slug}/seasons/${seasonSlug}` },
					{ name: "Session" },
				]}
				rightContent={
					<AlertDialog>
						<AlertDialogTrigger
							render={
								<Button variant="destructive" size="sm" className="gap-1.5">
									<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
									<span className="hidden sm:inline">End Session</span>
								</Button>
							}
						/>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>End this session?</AlertDialogTitle>
								<AlertDialogDescription>
									The session will be closed and a summary will be generated.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									onClick={endSession}
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								>
									End Session
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<SessionDashboardCards session={session} />
			</div>
		</>
	);
}

function SessionLivePage() {
	const { slug, seasonSlug, sessionId } = Route.useParams();
	const navigate = useNavigate();
	const client = trpcClient as AnyTRPC;

	const { data: session, isLoading } = useQuery({
		queryKey: ["session", sessionId],
		queryFn: () => client.session.getById.query({ sessionId }) as Promise<GameSession>,
	});

	useEffect(() => {
		const handler = (e: CustomEvent<SessionEventDetail>) => {
			const detail = e.detail;
			if (detail.type === "session:end" && detail.sessionId === sessionId) {
				if (detail.userName) {
					toast.info(`Session ended by ${detail.userName}`);
				}
				navigate({
					to: "/leagues/$slug/seasons/$seasonSlug",
					params: { slug, seasonSlug },
					replace: true,
				});
				return;
			}
		};
		window.addEventListener("session-event", handler);
		return () => window.removeEventListener("session-event", handler);
	}, [sessionId, navigate, slug, seasonSlug]);

	if (isLoading) return <LoadingState />;

	if (!session) {
		return (
			<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
				Session not found.{" "}
				<Link
					to="/leagues/$slug/seasons/$seasonSlug"
					params={{ slug, seasonSlug }}
					className="ml-1 underline"
				>
					Back to season
				</Link>
			</div>
		);
	}

	const settings = session.modeSettings;
	if (!settings) {
		return <LegacySessionFallback session={session} />;
	}

	switch (settings.mode) {
		case "winner-stays":
			return <WinnerStaysSession session={session} />;
		case "manual":
			return <ManualSession session={session} seasonSlug={seasonSlug} leagueSlug={slug} />;
		default:
			return exhaustiveCheck(settings);
	}
}
