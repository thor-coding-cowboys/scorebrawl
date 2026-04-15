import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpcClient, type AnyTRPC } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
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
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { truncateSlug } from "@/lib/utils";
import { toast } from "sonner";
import { WinnerStaysSession } from "./-components/winner-stays/winner-stays-session";
import { ManualSession } from "./-components/manual/manual-session";
import type { GameSession } from "./-components/session-types";
import { AddPlayerDialog } from "./-components/add-player-dialog";
import { useState } from "react";

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/"
)({
	component: SessionLivePage,
});

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

	const endSession = useMutation({
		mutationFn: () => client.session.end.mutate({ sessionId }) as Promise<unknown>,
		onSuccess: () => {
			navigate({
				to: "/leagues/$slug/seasons/$seasonSlug/session/$sessionId/summary",
				params: { slug, seasonSlug, sessionId },
			});
		},
		onError: () => toast.error("Failed to end session"),
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

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
				Loading session...
			</div>
		);
	}

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

			{session.rotationMode === "manual" ? (
				<ManualSession sessionId={sessionId} slug={slug} seasonSlug={seasonSlug} />
			) : (
				<WinnerStaysSession sessionId={sessionId} slug={slug} seasonSlug={seasonSlug} />
			)}

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
