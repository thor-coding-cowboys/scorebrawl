import { useState, useEffect, useRef } from "react";
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
	UserMultiple02Icon,
	PlayIcon,
	CheckmarkCircle01Icon,
	CoinsIcon,
	ArrowTurnBackwardIcon,
	Delete02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { fisherYatesShuffle, enforceAlwaysSplit, getPlayerBySeasonId } from "../session-utils";
import { SessionDashboardCards } from "../session-dashboard-cards";
import { ScoreStepper, TeamRosterCard } from "../score-stepper";
import { SessionStandings } from "../session-standings";
import type {
	GameSession,
	ProposedLineup,
	TeamAssignment,
	PlayerWithTeam,
	SessionPlayer,
	SessionMatch,
} from "../session-types";
import { QueuePanel } from "./queue-panel";
import { CoinTossDialog } from "./coin-toss-dialog";
import { PlayerSelectionDrawer } from "@/routes/-components/ui/player-selection-drawer";
import { SessionSettingsDialog } from "../session-settings-dialog";
import { Settings02Icon } from "@hugeicons/core-free-icons";

interface WinnerStaysSessionProps {
	sessionId: string;
	slug: string;
	seasonSlug: string;
}

export function WinnerStaysSession({ sessionId, slug, seasonSlug }: WinnerStaysSessionProps) {
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
			localShuffleRef.current = null;
			setProposedLineup(null);
			setTeamAssignment([]);
			setPendingCoinTossId(null);
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

	const [proposedLineup, setProposedLineup] = useState<ProposedLineup>(null);
	const [pendingCoinTossId, setPendingCoinTossId] = useState<string | null>(null);
	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);
	const [showCoinToss, setShowCoinToss] = useState(false);
	const [showPlayerDrawer, setShowPlayerDrawer] = useState(false);
	const [showUndoDialog, setShowUndoDialog] = useState(false);
	const [showSettingsDialog, setShowSettingsDialog] = useState(false);

	const [teamAssignment, setTeamAssignment] = useState<PlayerWithTeam[]>([]);
	const [isShuffling, setIsShuffling] = useState(false);
	const shuffleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const waitingForMatchDataRef = useRef(false);
	const localShuffleRef = useRef<{ homeIds: string[]; awayIds: string[] } | null>(null);

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

	const updateHomeScore = (updater: (prev: number) => number) => {
		setHomeScore(updater);
	};

	const updateAwayScore = (updater: (prev: number) => number) => {
		setAwayScore(updater);
	};

	useEffect(() => {
		if (!session) return;

		const activeMatch = session.matches.find((m) => m.result === null);

		if (waitingForMatchDataRef.current && (activeMatch || session.proposedLineup)) {
			waitingForMatchDataRef.current = false;
			setIsShuffling(false);
			if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
		}

		setTeamAssignment((prev) => {
			const existingIds = new Set(prev.map((p) => p.id));

			if (activeMatch) {
				localShuffleRef.current = null;
				const useSelected = !!activeMatch.selectedHomePlayerIds?.length;
				const homeIds = useSelected
					? activeMatch.selectedHomePlayerIds!
					: activeMatch.homePlayerIds;
				const awayIds = useSelected
					? activeMatch.selectedAwayPlayerIds!
					: activeMatch.awayPlayerIds;
				const merged = session.players.map((p) => {
					const existing = prev.find((e) => e.id === p.id);
					const key = useSelected ? p.id : p.seasonPlayerId;
					const team: TeamAssignment = homeIds.includes(key)
						? "home"
						: awayIds.includes(key)
							? "away"
							: undefined;
					return existing ? { ...existing, ...p, team } : { ...p, team };
				});
				return merged;
			}

			if (session.proposedLineup && !activeMatch) {
				const homeIds = localShuffleRef.current?.homeIds?.length
					? localShuffleRef.current.homeIds
					: session.proposedLineup.selectedHomePlayerIds?.length
						? session.proposedLineup.selectedHomePlayerIds
						: session.proposedLineup.homePlayerIds;
				const awayIds = localShuffleRef.current?.awayIds?.length
					? localShuffleRef.current.awayIds
					: session.proposedLineup.selectedAwayPlayerIds?.length
						? session.proposedLineup.selectedAwayPlayerIds
						: session.proposedLineup.awayPlayerIds;
				const merged = session.players.map((p) => {
					const existing = prev.find((e) => e.id === p.id);
					const team: TeamAssignment = homeIds.includes(p.id)
						? "home"
						: awayIds.includes(p.id)
							? "away"
							: undefined;
					return existing ? { ...existing, ...p, team } : { ...p, team };
				});
				return merged;
			}

			const merged = session.players.map((p) => {
				const existing = prev.find((e) => e.id === p.id);
				return existing ? { ...existing, ...p } : { ...p, team: undefined as TeamAssignment };
			});

			if (
				prev.length === 0 ||
				prev.some((p) => !session.players.find((sp) => sp.id === p.id)) ||
				session.players.some((p) => !existingIds.has(p.id))
			) {
				return merged;
			}
			return prev.map((p) => {
				const updated = session.players.find((sp) => sp.id === p.id);
				return updated ? { ...p, ...updated, team: p.team } : p;
			});
		});
	}, [session]);

	const pendingCoinToss = session?.pendingCoinTosses?.[0] ?? null;
	const coinTossActive = !!pendingCoinToss;
	const coinTossCandidates =
		pendingCoinToss?.candidates ?? proposedLineup?.coinTossNeeded?.candidates ?? [];

	const homePlayers = teamAssignment.filter((p) => p.team === "home");
	const awayPlayers = teamAssignment.filter((p) => p.team === "away");
	const teamsBalanced = homePlayers.length === awayPlayers.length && homePlayers.length > 0;

	const {
		startNextMatch,
		recordResult,
		cancelMatch,
		deleteLastMatch,
		removePlayer,
		rejoinPlayer,
		updateTeamSelection,
		updateProposedLineup,
		resolveCoinToss,
		updateSettings,
	} = useSessionMutations(sessionId, seasonSlug, { slug, seasonSlug });

	const saveTeamSelection = () => {
		const homeIds = teamAssignment.filter((p) => p.team === "home").map((p) => p.id);
		const awayIds = teamAssignment.filter((p) => p.team === "away").map((p) => p.id);

		if (currentMatch && currentMatch.result === null) {
			updateTeamSelection.mutate({
				sessionId,
				sessionMatchId: currentMatch.id,
				selectedHomePlayerIds: homeIds,
				selectedAwayPlayerIds: awayIds,
			});
		} else {
			const currentProposed = proposedLineup || {
				homePlayerIds: [],
				awayPlayerIds: [],
				rotatedOut: [],
				coinTossNeeded: null,
			};
			updateProposedLineup.mutate({
				sessionId,
				proposedLineup: {
					...currentProposed,
					selectedHomePlayerIds: homeIds,
					selectedAwayPlayerIds: awayIds,
				},
			});
		}
	};

	const handleStartMatch = () => {
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

	const handleCoinResolve = (winnerId: string) => {
		const coinTossId = pendingCoinTossId ?? pendingCoinToss?.id ?? null;
		if (coinTossId) {
			resolveCoinToss.mutate({ coinTossId, resolvedWinnerIds: [winnerId] });
		} else {
			setShowCoinToss(false);
		}
	};

	const handleShuffle = () => {
		if (!session) return;
		const available = session.players.filter((p) => p.status !== "out");
		const shuffled = fisherYatesShuffle(available);
		const rawHome = shuffled.slice(0, session.teamSize).map((p) => p.id);
		const rawAway = shuffled.slice(session.teamSize, session.teamSize * 2).map((p) => p.id);
		const { homeIds: fixedHome, awayIds: fixedAway } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.modeSettings?.alwaysSplitConstraints ?? [],
			session.players
		);
		const homeSet = new Set(fixedHome);
		const awaySet = new Set(fixedAway);
		setTeamAssignment((prev) =>
			prev.map((p) => ({
				...p,
				team: homeSet.has(p.id) ? "home" : awaySet.has(p.id) ? "away" : undefined,
			}))
		);
	};

	const handleShuffleSelected = () => {
		if (!session) return;
		const selected = teamAssignment.filter((p) => p.team);
		const shuffled = fisherYatesShuffle(selected);
		const rawHome = shuffled.slice(0, session.teamSize).map((p) => p.id);
		const rawAway = shuffled.slice(session.teamSize, session.teamSize * 2).map((p) => p.id);
		const { homeIds: fixedHome, awayIds: fixedAway } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.modeSettings?.alwaysSplitConstraints ?? [],
			session.players
		);
		const homeSet = new Set(fixedHome);
		const awaySet = new Set(fixedAway);
		setTeamAssignment((prev) =>
			prev.map((p) => ({
				...p,
				team: homeSet.has(p.id) ? "home" : awaySet.has(p.id) ? "away" : p.team,
			}))
		);
	};

	const handleEven = () => {
		if (!session) return;
		const available = session.players.filter((p) => p.status !== "out");
		const sorted = [...available].sort((a, b) => b.score - a.score);
		const rawHome: string[] = [];
		const rawAway: string[] = [];
		let homeTotal = 0;
		let awayTotal = 0;
		for (const p of sorted) {
			if (rawHome.length < session.teamSize || homeTotal <= awayTotal) {
				rawHome.push(p.id);
				homeTotal += p.score;
			} else if (rawAway.length < session.teamSize) {
				rawAway.push(p.id);
				awayTotal += p.score;
			}
		}
		const { homeIds: fixedHome, awayIds: fixedAway } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.modeSettings?.alwaysSplitConstraints ?? [],
			session.players
		);
		const homeSet = new Set(fixedHome);
		const awaySet = new Set(fixedAway);
		setTeamAssignment((prev) =>
			prev.map((p) => ({
				...p,
				team: homeSet.has(p.id) ? "home" : awaySet.has(p.id) ? "away" : undefined,
			}))
		);
	};

	const handleRotation = () => {
		if (!session) return;
		if (
			proposedLineup &&
			(proposedLineup.homePlayerIds.length > 0 || proposedLineup.awayPlayerIds.length > 0)
		) {
			setTeamAssignment(
				session.players.map((p) => {
					let team: TeamAssignment = undefined;
					if (proposedLineup.homePlayerIds.includes(p.id)) team = "home";
					else if (proposedLineup.awayPlayerIds.includes(p.id)) team = "away";
					return { ...p, team };
				})
			);
		} else {
			const available = session.players
				.filter((p) => p.status !== "out")
				.sort((a, b) => a.queuePosition - b.queuePosition);
			const rawHome = available.slice(0, session.teamSize).map((p) => p.id);
			const rawAway = available.slice(session.teamSize, session.teamSize * 2).map((p) => p.id);
			const { homeIds: fixedHome, awayIds: fixedAway } = enforceAlwaysSplit(
				rawHome,
				rawAway,
				session.modeSettings?.alwaysSplitConstraints ?? [],
				session.players
			);
			const homeSet = new Set(fixedHome);
			const awaySet = new Set(fixedAway);
			setTeamAssignment((prev) =>
				prev.map((p) => ({
					...p,
					team: homeSet.has(p.id) ? "home" : awaySet.has(p.id) ? "away" : undefined,
				}))
			);
		}
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

	const canSelectTeam = !currentMatch && !coinTossActive;
	const canReorder =
		teamAssignment.filter((p) => p.team).length % 2 === 0 &&
		teamAssignment.filter((p) => p.team).length >= 2;

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<SessionDashboardCards session={session} />
			<div className="flex justify-end">
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowSettingsDialog(true)}
					className="gap-1.5"
					disabled={updateSettings.isPending}
				>
					<HugeiconsIcon icon={Settings02Icon} className="size-4" />
					{updateSettings.isPending ? "Updating..." : "Settings"}
				</Button>
			</div>

			<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
				<div className="flex flex-col gap-4">
					<MatchCard
						currentMatch={currentMatch}
						homeScore={homeScore}
						awayScore={awayScore}
						updateHomeScore={updateHomeScore}
						updateAwayScore={updateAwayScore}
						allMatches={allMatches}
						coinTossActive={coinTossActive}
						session={session}
						homePlayers={homePlayers}
						awayPlayers={awayPlayers}
						teamsBalanced={teamsBalanced}
						isShuffling={isShuffling}
						showUndoDialog={showUndoDialog}
						setShowUndoDialog={setShowUndoDialog}
						setShowCoinToss={setShowCoinToss}
						handleRecordResult={handleRecordResult}
						handleStartMatch={handleStartMatch}
						cancelMatch={cancelMatch}
						deleteLastMatch={deleteLastMatch}
						recordResult={recordResult}
						startNextMatch={startNextMatch}
						setShowPlayerDrawer={setShowPlayerDrawer}
					/>

					<QueueCard session={session} removePlayer={removePlayer} rejoinPlayer={rejoinPlayer} />
				</div>

				<div className="flex flex-col gap-4">
					<SessionStandings
						seasonSlug={seasonSlug}
						leagueSlug={slug}
						sessionPlayers={session.players}
					/>
				</div>
			</div>

			{canSelectTeam && (
				<PlayerSelectionDrawer
					isOpen={showPlayerDrawer}
					onClose={() => {
						saveTeamSelection();
						setShowPlayerDrawer(false);
					}}
					players={teamAssignment.map((p) => ({
						id: p.id,
						name: p.displayName,
						image: p.playerImage,
						score: p.score,
						team: p.team,
					}))}
					onPlayerSelect={(player) => {
						setTeamAssignment((prev) =>
							prev.map((p) => (p.id === player.id ? { ...p, team: player.team } : p))
						);
					}}
					onShuffle={handleShuffle}
					onShuffleSelected={handleShuffleSelected}
					onEven={handleEven}
					onRotation={handleRotation}
					canReorder={canReorder}
				/>
			)}

			<CoinTossDialog
				open={showCoinToss}
				candidates={coinTossCandidates}
				session={session}
				onResolve={handleCoinResolve}
			/>

			<SessionSettingsDialog
				isOpen={showSettingsDialog}
				onClose={() => setShowSettingsDialog(false)}
				session={session}
				sessionId={sessionId}
			/>
		</div>
	);
}

function MatchCard({
	currentMatch,
	homeScore,
	awayScore,
	updateHomeScore,
	updateAwayScore,
	allMatches,
	coinTossActive,
	session,
	homePlayers,
	awayPlayers,
	teamsBalanced,
	isShuffling,
	showUndoDialog,
	setShowUndoDialog,
	setShowCoinToss,
	handleRecordResult,
	handleStartMatch,
	cancelMatch,
	deleteLastMatch,
	recordResult,
	startNextMatch,
	setShowPlayerDrawer,
}: {
	currentMatch: SessionMatch | null;
	homeScore: number;
	awayScore: number;
	updateHomeScore: (updater: (prev: number) => number) => void;
	updateAwayScore: (updater: (prev: number) => number) => void;
	allMatches: SessionMatch[];
	coinTossActive: boolean;
	session: GameSession;
	homePlayers: PlayerWithTeam[];
	awayPlayers: PlayerWithTeam[];
	teamsBalanced: boolean;
	isShuffling: boolean;
	showUndoDialog: boolean;
	setShowUndoDialog: (open: boolean) => void;
	setShowCoinToss: (open: boolean) => void;
	handleRecordResult: () => void;
	handleStartMatch: () => void;
	cancelMatch: ReturnType<typeof useSessionMutations>["cancelMatch"];
	deleteLastMatch: ReturnType<typeof useSessionMutations>["deleteLastMatch"];
	recordResult: ReturnType<typeof useSessionMutations>["recordResult"];
	startNextMatch: ReturnType<typeof useSessionMutations>["startNextMatch"];
	setShowPlayerDrawer: (open: boolean) => void;
}) {
	return (
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
					{coinTossActive && !currentMatch && (
						<Button size="sm" onClick={() => setShowCoinToss(true)} className="gap-1.5">
							<HugeiconsIcon icon={CoinsIcon} className="size-4" />
							Coin Toss
						</Button>
					)}
				</div>
			</div>

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
								disabled={recordResult.isPending || isShuffling}
								className="w-full gap-2"
							>
								<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
								{recordResult.isPending
									? "Recording..."
									: isShuffling
										? "Loading teams..."
										: "Record Result"}
							</GlowButton>
							<Button
								variant="ghost"
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
						<div className="grid grid-cols-2 gap-4">
							<TeamRosterCard
								label="Home"
								players={homePlayers}
								emptyHint={`${session.teamSize} player${session.teamSize !== 1 ? "s" : ""}`}
								isShuffling={isShuffling}
								expectedPlayerCount={session.teamSize}
							/>
							<TeamRosterCard
								label="Away"
								players={awayPlayers}
								emptyHint={`${session.teamSize} player${session.teamSize !== 1 ? "s" : ""}`}
								isShuffling={isShuffling}
								expectedPlayerCount={session.teamSize}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Button
								variant="outline"
								onClick={() => setShowPlayerDrawer(true)}
								className="w-full gap-1.5"
							>
								<HugeiconsIcon icon={UserMultiple02Icon} className="size-4" />
								Select Players
							</Button>
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
												This will delete the last recorded match and revert all scores and stats.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => {
													deleteLastMatch.mutate();
													setShowUndoDialog(false);
												}}
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
	);
}

function QueueCard({
	session,
	removePlayer,
	rejoinPlayer,
}: {
	session: GameSession;
	removePlayer: ReturnType<typeof useSessionMutations>["removePlayer"];
	rejoinPlayer: ReturnType<typeof useSessionMutations>["rejoinPlayer"];
}) {
	return (
		<Card className="p-4">
			<div className="px-4 pb-2 pt-1">
				<span className="text-sm font-semibold">Players</span>
			</div>
			<QueuePanel
				session={session}
				onRemovePlayer={
					session.players.filter((p) => p.status !== "out").length > session.teamSize * 2
						? (sessionPlayerId) => removePlayer.mutate({ sessionId: session.id, sessionPlayerId })
						: undefined
				}
				isRemoving={removePlayer.isPending}
				onRejoinPlayer={(seasonPlayerId) =>
					rejoinPlayer.mutate({ sessionId: session.id, seasonPlayerId })
				}
				isRejoining={rejoinPlayer.isPending}
			/>
			{(session.modeSettings?.alwaysSplitConstraints?.length ?? 0) > 0 && (
				<div className="mt-3 text-xs text-muted-foreground space-y-1">
					<span className="font-medium text-foreground text-sm">Always Split</span>
					{session.modeSettings?.alwaysSplitConstraints?.map(([a, b]: [string, string]) => {
						const pA = session.players.find((p) => p.seasonPlayerId === a);
						const pB = session.players.find((p) => p.seasonPlayerId === b);
						if (!pA || !pB) return null;
						return (
							<div key={`${a}-${b}`}>
								{pA.displayName} / {pB.displayName}
							</div>
						);
					})}
				</div>
			)}
		</Card>
	);
}
