import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trpcClient, type AnyTRPC } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/routes/-components/ui/glow-button";
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
	Cancel01Icon,
	Delete02Icon,
} from "@hugeicons/core-free-icons";
import { debounce } from "@/lib/utils";
import { toast } from "sonner";
import { OverviewCard } from "../../../../../-components/season/overview-card";
import {
	ScoreStepper,
	TeamRosterCard,
	SessionStandings,
	type GameSession,
	type SessionPlayer,
	type SessionMatch,
	type TeamAssignment,
} from "../index";
import { TeamPicker } from "./team-picker";

export function ManualSession({
	session,
	seasonSlug,
	leagueSlug,
}: {
	session: GameSession;
	seasonSlug: string;
	leagueSlug: string;
}) {
	const queryClient = useQueryClient();
	const client = trpcClient as AnyTRPC;

	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);
	const [teamAssignment, setTeamAssignment] = useState<Map<string, TeamAssignment>>(new Map());
	const [showUndoDialog, setShowUndoDialog] = useState(false);

	const lastLocalChangeRef = useRef<number>(0);
	const currentMatchRef = useRef<SessionMatch | null>(null);

	const currentMatch = session.matches.find((m) => m.result === null) ?? null;
	const currentMatchId = currentMatch?.id ?? null;
	const prevMatchIdRef = useRef<string | null>(currentMatchId);

	if (currentMatchId !== prevMatchIdRef.current) {
		prevMatchIdRef.current = currentMatchId;
		setHomeScore(currentMatch?.homeSessionScore ?? 0);
		setAwayScore(currentMatch?.awaySessionScore ?? 0);
	}

	useEffect(() => {
		if (!session) return;

		const activeMatch = session.matches.find((m) => m.result === null);
		currentMatchRef.current = activeMatch ?? null;

		if (activeMatch) {
			const homeIds = new Set(activeMatch.homePlayerIds);
			const awayIds = new Set(activeMatch.awayPlayerIds);
			const newAssignment = new Map<string, TeamAssignment>();
			for (const p of session.players) {
				if (homeIds.has(p.seasonPlayerId)) {
					newAssignment.set(p.id, "home");
				} else if (awayIds.has(p.seasonPlayerId)) {
					newAssignment.set(p.id, "away");
				}
			}
			setTeamAssignment(newAssignment);
		}
	}, [session]);

	const updateHomeScore = (updater: (prev: number) => number) => {
		lastLocalChangeRef.current = Date.now();
		setHomeScore(updater);
	};

	const updateAwayScore = (updater: (prev: number) => number) => {
		lastLocalChangeRef.current = Date.now();
		setAwayScore(updater);
	};

	const updateMatchScore = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			homeScore: number;
			awayScore: number;
		}) => client.session.updateMatchScore.mutate(input),
	});
	const updateMatchScoreRef = useRef(updateMatchScore);
	updateMatchScoreRef.current = updateMatchScore;

	const debouncedUpdateScore = useMemo(
		() =>
			debounce((home: number, away: number) => {
				const match = currentMatchRef.current;
				if (!match) return;
				updateMatchScoreRef.current.mutate({
					sessionId: session.id,
					sessionMatchId: match.id,
					homeScore: home,
					awayScore: away,
				});
			}, 300),
		[session.id]
	);

	useEffect(() => {
		if (!currentMatchRef.current) return;
		debouncedUpdateScore(homeScore, awayScore);
		return () => debouncedUpdateScore.cancel();
	}, [homeScore, awayScore, debouncedUpdateScore]);

	const startNextMatch = useMutation({
		mutationFn: (input: {
			sessionId: string;
			homeSeasonPlayerIds: string[];
			awaySeasonPlayerIds: string[];
		}) => client.session.startNextMatch.mutate(input) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", session.id] });
		},
		onError: () => toast.error("Failed to start match"),
	});

	const recordResult = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			homeScore: number;
			awayScore: number;
		}) => client.session.recordResult.mutate(input) as Promise<unknown>,
		onSuccess: () => {
			setHomeScore(0);
			setAwayScore(0);
			setTeamAssignment(new Map());
			queryClient.invalidateQueries({ queryKey: ["session", session.id] });
			toast.success("Match recorded");
		},
		onError: () => toast.error("Failed to record result"),
	});

	const cancelMatch = useMutation({
		mutationFn: () => client.session.cancelMatch.mutate({ sessionId: session.id }) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", session.id] });
			setHomeScore(0);
			setAwayScore(0);
		},
		onError: () => toast.error("Failed to cancel match"),
	});

	const deleteLastMatch = useMutation({
		mutationFn: () => client.session.deleteLastMatch.mutate({ sessionId: session.id }) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", session.id] });
			setShowUndoDialog(false);
			toast.success("Last match deleted");
		},
		onError: () => toast.error("Failed to delete last match"),
	});

	const handleAssignPlayer = (playerId: string, team: TeamAssignment) => {
		lastLocalChangeRef.current = Date.now();
		setTeamAssignment((prev) => {
			const next = new Map(prev);
			if (team === undefined) {
				next.delete(playerId);
			} else {
				next.set(playerId, team);
			}
			return next;
		});
	};

	const homePlayers = session.players.filter((p) => teamAssignment.get(p.id) === "home");
	const awayPlayers = session.players.filter((p) => teamAssignment.get(p.id) === "away");
	const teamsBalanced = homePlayers.length === awayPlayers.length && homePlayers.length > 0;

	const handleStartMatch = () => {
		startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: homePlayers.map((p) => p.seasonPlayerId),
			awaySeasonPlayerIds: awayPlayers.map((p) => p.seasonPlayerId),
		});
	};

	const handleRecordResult = () => {
		if (!currentMatch) return;
		recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: currentMatch.id,
			homeScore,
			awayScore,
		});
	};

	const allMatches = session?.matches ?? [];
	const completedMatches = allMatches.filter((m) => m.result !== null);

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
				<div className="flex flex-col gap-4">
					<OverviewCard
						title={currentMatch ? `Match #${currentMatch.matchNumber}` : "Next Match"}
						action={
							<div className="flex items-center gap-2">
								{currentMatch && (
									<Badge variant="secondary" className="text-xs">
										In Progress
									</Badge>
								)}
								{!currentMatch && (
									<span className="text-xs text-muted-foreground">
										{completedMatches.length} played
									</span>
								)}
							</div>
						}
					>
						<div className="flex flex-col gap-4">
							<div className="bg-muted/30">
								<div className="grid grid-cols-2">
									<ScoreStepper
										label="Home"
										score={homeScore}
										onIncrement={() => updateHomeScore((s) => s + 1)}
										onDecrement={() => updateHomeScore((s) => Math.max(0, s - 1))}
										disabled={!currentMatch}
									/>
									<ScoreStepper
										label="Away"
										score={awayScore}
										onIncrement={() => updateAwayScore((s) => s + 1)}
										onDecrement={() => updateAwayScore((s) => Math.max(0, s - 1))}
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
												.map((sid) => session.players.find((p) => p.seasonPlayerId === sid))
												.filter((p): p is SessionPlayer => p !== undefined)}
										/>
										<TeamRosterCard
											label="Away"
											players={currentMatch.awayPlayerIds
												.map((sid) => session.players.find((p) => p.seasonPlayerId === sid))
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
											<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
											{cancelMatch.isPending ? "Cancelling..." : "Cancel Match"}
										</Button>
									</div>
								</>
							) : (
								<>
									<TeamPicker
										players={session.players}
										teamAssignment={teamAssignment}
										onAssignPlayer={handleAssignPlayer}
										teamSize={session.teamSize}
									/>

									<div className="flex flex-col gap-2">
										<GlowButton
											glowColor={glowColors.blue}
											onClick={handleStartMatch}
											disabled={
												!teamsBalanced ||
												homePlayers.length !== session.teamSize ||
												startNextMatch.isPending
											}
											className="w-full gap-2"
										>
											<HugeiconsIcon icon={PlayIcon} className="size-4" />
											{startNextMatch.isPending ? "Starting..." : "Start Match"}
										</GlowButton>

										{completedMatches.length > 0 && (
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
					</OverviewCard>
				</div>

				<div className="flex flex-col gap-4">
					<SessionStandings
						seasonSlug={seasonSlug}
						leagueSlug={leagueSlug}
						sessionPlayers={session.players}
					/>
				</div>
			</div>
		</div>
	);
}
