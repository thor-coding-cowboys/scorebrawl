import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { useSession } from "@/hooks/useSession";
import { useSessionMutations } from "@/hooks/use-session-mutations";
import { useScoreSync } from "@/hooks/use-score-sync";
import { useSessionSSE } from "@/hooks/use-session-sse";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Badge } from "@/components/ui/badge";
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
import {
	PlayIcon,
	CheckmarkCircle01Icon,
	ArrowTurnBackwardIcon,
	Delete02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { getPlayerBySeasonId } from "../session-utils";
import { SessionDashboardCards } from "../session-dashboard-cards";
import { ScoreStepper, TeamRosterCard } from "../score-stepper";
import { SessionStandings } from "../session-standings";
import type { GameSession, PlayerWithTeam, SessionPlayer, TeamAssignment } from "../session-types";
import { TeamPicker } from "./team-picker";

interface ManualSessionProps {
	sessionId: string;
	slug: string;
	seasonSlug: string;
}

export function ManualSession({ sessionId, slug, seasonSlug }: ManualSessionProps) {
	const navigate = useNavigate();
	const { data: authSession } = useSession();

	const { data: session, isLoading } = useQuery({
		queryKey: ["session", sessionId],
		queryFn: () =>
			trpcClient.session.getById.query({ sessionId }) as unknown as Promise<GameSession>,
	});

	const currentMatchRef = useRef<{ id: string } | null>(null);

	const handleSessionEnd = (userName?: string) => {
		if (userName) {
			toast.info(`Session ended by ${userName}`);
		}
		navigate({
			to: "/leagues/$slug/seasons/$seasonSlug",
			params: { slug, seasonSlug },
			replace: true,
		});
	};

	const handleSessionUpdate = (isOwnUpdate: boolean) => {
		if (!isOwnUpdate) {
			setTeamAssignment([]);
			setHomeScore(0);
			setAwayScore(0);
		}
	};

	const { setAuthSession } = useSessionSSE({
		sessionId,
		onSessionEnd: handleSessionEnd,
		onSessionUpdate: handleSessionUpdate,
	});

	useEffect(() => {
		if (authSession) {
			setAuthSession(authSession);
		}
	}, [authSession, setAuthSession]);

	const [teamAssignment, setTeamAssignment] = useState<PlayerWithTeam[]>([]);
	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);
	const [showUndoDialog, setShowUndoDialog] = useState(false);

	const allMatches = session?.matches ?? [];
	const currentMatch = allMatches.find((m) => m.result === null) ?? null;
	currentMatchRef.current = currentMatch ? { id: currentMatch.id } : null;

	const currentMatchId = currentMatch?.id ?? null;
	const prevMatchIdRef = useRef<string | null>(currentMatchId);
	if (currentMatchId !== prevMatchIdRef.current) {
		prevMatchIdRef.current = currentMatchId;
		setHomeScore(currentMatch?.homeSessionScore ?? 0);
		setAwayScore(currentMatch?.awaySessionScore ?? 0);
	}

	useScoreSync(sessionId, currentMatchRef);

	useEffect(() => {
		if (!session) return;
		setTeamAssignment((prev) => {
			const activeMatch = session.matches.find((m) => m.result === null);
			if (activeMatch) {
				const useSelected = !!activeMatch.selectedHomePlayerIds?.length;
				const homeIds = useSelected
					? activeMatch.selectedHomePlayerIds!
					: activeMatch.homePlayerIds;
				const awayIds = useSelected
					? activeMatch.selectedAwayPlayerIds!
					: activeMatch.awayPlayerIds;
				return session.players.map((p) => {
					const existing = prev.find((e) => e.id === p.id);
					const key = useSelected ? p.id : p.seasonPlayerId;
					const team: TeamAssignment = homeIds.includes(key)
						? "home"
						: awayIds.includes(key)
							? "away"
							: undefined;
					return existing ? { ...existing, ...p, team } : { ...p, team };
				});
			}
			return session.players.map((p) => {
				const existing = prev.find((e) => e.id === p.id);
				return existing ? { ...existing, ...p, team: existing.team } : { ...p, team: undefined };
			});
		});
	}, [session]);

	const { startNextMatch, recordResult, cancelMatch, deleteLastMatch } = useSessionMutations(
		sessionId,
		seasonSlug,
		{ slug, seasonSlug }
	);

	const homePlayers = teamAssignment.filter((p) => p.team === "home");
	const awayPlayers = teamAssignment.filter((p) => p.team === "away");
	const teamsBalanced =
		homePlayers.length === awayPlayers.length && homePlayers.length > 0 && session
			? homePlayers.length === session.teamSize
			: false;

	const handleAssignPlayer = (playerId: string, team: TeamAssignment) => {
		setTeamAssignment((prev) => prev.map((p) => (p.id === playerId ? { ...p, team } : p)));
	};

	const saveAndStartMatch = () => {
		if (!session) return;
		startNextMatch.mutate({
			sessionId,
			homeSeasonPlayerIds: homePlayers.map((p) => p.seasonPlayerId),
			awaySeasonPlayerIds: awayPlayers.map((p) => p.seasonPlayerId),
		});
	};

	const handleRecordResult = () => {
		if (!currentMatch) return;
		recordResult.mutate({ sessionId, sessionMatchId: currentMatch.id, homeScore, awayScore });
	};

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
				Session not found.
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<SessionDashboardCards session={session} />

			<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
				<div className="flex flex-col gap-4">
					<Card className="p-4">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-sm font-bold font-mono">
								{currentMatch ? `Match #${currentMatch.matchNumber}` : "Next Match"}
							</h2>
							<div className="flex items-center gap-2">
								{currentMatch && (
									<Badge variant="secondary" className="text-xs">
										In Progress
									</Badge>
								)}
								{!currentMatch && (
									<span className="text-xs text-muted-foreground">
										{allMatches.filter((m) => m.result !== null).length} played
									</span>
								)}
							</div>
						</div>

						<div className="flex flex-col gap-4">
							<div className="bg-muted/30">
								<div className="grid grid-cols-2">
									<ScoreStepper
										label="Home"
										score={homeScore}
										onIncrement={() => setHomeScore((s) => s + 1)}
										onDecrement={() => setHomeScore((s) => Math.max(0, s - 1))}
										disabled={!currentMatch}
									/>
									<ScoreStepper
										label="Away"
										score={awayScore}
										onIncrement={() => setAwayScore((s) => s + 1)}
										onDecrement={() => setAwayScore((s) => Math.max(0, s - 1))}
										disabled={!currentMatch}
									/>
								</div>
							</div>

							{currentMatch ? (
								<>
									<div className="grid grid-cols-2 gap-4">
										<TeamRosterCard
											label="Home"
											players={currentMatch.homePlayerIds
												.map((sid: string) => getPlayerBySeasonId(session, sid))
												.filter((p): p is SessionPlayer => p !== undefined)}
										/>
										<TeamRosterCard
											label="Away"
											players={currentMatch.awayPlayerIds
												.map((sid: string) => getPlayerBySeasonId(session, sid))
												.filter((p): p is SessionPlayer => p !== undefined)}
										/>
									</div>
									<div className="flex flex-col gap-2">
										<GlowButton
											glowColor={glowColors.blue}
											onClick={handleRecordResult}
											disabled={recordResult.isPending}
											className="w-full gap-2"
										>
											<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
											{recordResult.isPending ? "Recording..." : "Record Result"}
										</GlowButton>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => cancelMatch.mutate()}
											disabled={cancelMatch.isPending}
											className="w-full gap-1.5 text-muted-foreground"
										>
											<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-4" />
											{cancelMatch.isPending ? "Cancelling..." : "Cancel Match"}
										</Button>
									</div>
								</>
							) : (
								<>
									<TeamPicker
										players={teamAssignment}
										teamSize={session.teamSize}
										onAssignPlayer={handleAssignPlayer}
									/>
									<div className="flex flex-col gap-2">
										<GlowButton
											glowColor={glowColors.blue}
											onClick={saveAndStartMatch}
											disabled={!teamsBalanced || startNextMatch.isPending}
											className="w-full gap-2"
										>
											<HugeiconsIcon icon={PlayIcon} className="size-4" />
											{startNextMatch.isPending ? "Starting..." : "Start Match"}
										</GlowButton>
										{allMatches.some((m) => m.result !== null) && (
											<AlertDialog open={showUndoDialog} onOpenChange={setShowUndoDialog}>
												<AlertDialogTrigger
													render={
														<Button
															variant="ghost"
															size="sm"
															disabled={deleteLastMatch.isPending}
															className="w-full gap-1.5 text-muted-foreground"
														>
															<HugeiconsIcon icon={Delete02Icon} className="size-4" />
															{deleteLastMatch.isPending ? "Deleting..." : "Undo Last Match"}
														</Button>
													}
												/>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Undo last match?</AlertDialogTitle>
														<AlertDialogDescription>
															This will delete the last recorded match and revert all scores and
															stats.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={() => deleteLastMatch.mutate()}
															disabled={deleteLastMatch.isPending}
															className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
														>
															{deleteLastMatch.isPending ? "Deleting..." : "Undo Match"}
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										)}
									</div>
								</>
							)}
						</div>
					</Card>
				</div>

				<div className="flex flex-col gap-4">
					<SessionStandings
						seasonSlug={seasonSlug}
						leagueSlug={slug}
						sessionPlayers={session.players}
					/>
				</div>
			</div>
		</div>
	);
}
