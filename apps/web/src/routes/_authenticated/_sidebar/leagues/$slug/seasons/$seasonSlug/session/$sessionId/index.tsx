import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpcClient, type AnyTRPC } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { truncateSlug } from "@/lib/utils";
import { toast } from "sonner";
import type { SessionEventDetail } from "@/lib/event-types";
import { type GameSession, AddPlayerDialog } from "./-components";
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

function LegacySessionFallback({ session: _session }: { session: GameSession }) {
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
				<p className="text-muted-foreground">Legacy session view</p>
			</div>
		</>
	);
}

function SessionLivePage() {
	const { slug, seasonSlug, sessionId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const client = trpcClient as AnyTRPC;

	const [showAddPlayer, setShowAddPlayer] = useState(false);

	const { data: session, isLoading } = useQuery({
		queryKey: ["session", sessionId],
		queryFn: () => client.session.getById.query({ sessionId }) as Promise<GameSession>,
	});

	const addPlayer = useMutation({
		mutationFn: (input: { sessionId: string; seasonPlayerId: string }) =>
			client.session.addPlayer.mutate(input) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			setShowAddPlayer(false);
		},
		onError: () => toast.error("Failed to add player"),
	});

	const endSession = useMutation({
		mutationFn: () => client.session.end.mutate({ sessionId }) as Promise<unknown>,
		onSuccess: () => {
			navigate({
				to: "/leagues/$slug/seasons/$seasonSlug",
				params: { slug, seasonSlug },
				replace: true,
			});
		},
		onError: () => toast.error("Failed to end session"),
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
			if (detail.type === "session:update" && detail.sessionId === sessionId) {
				queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			}
		};
		window.addEventListener("session-event", handler);
		return () => window.removeEventListener("session-event", handler);
	}, [sessionId, queryClient, navigate, slug, seasonSlug]);

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

	let content: React.ReactNode;
	switch (settings.mode) {
		case "winner-stays":
			content = <WinnerStaysSession session={session} seasonSlug={seasonSlug} leagueSlug={slug} />;
			break;
		case "manual":
			content = <ManualSession session={session} seasonSlug={seasonSlug} leagueSlug={slug} />;
			break;
		default:
			return exhaustiveCheck(settings);
	}

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
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowAddPlayer(true)}
							className="gap-1.5"
						>
							<HugeiconsIcon icon={Add01Icon} className="size-4" />
							<span className="hidden sm:inline">Player</span>
						</Button>
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
										onClick={() => endSession.mutate()}
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										End Session
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				}
			/>
			{content}
			<AddPlayerDialog
				open={showAddPlayer}
				onOpenChange={setShowAddPlayer}
				session={session}
				seasonSlug={seasonSlug}
				onAdd={(seasonPlayerId) => addPlayer.mutate({ sessionId, seasonPlayerId })}
				isAdding={addPlayer.isPending}
			/>
		</>
	);
}
