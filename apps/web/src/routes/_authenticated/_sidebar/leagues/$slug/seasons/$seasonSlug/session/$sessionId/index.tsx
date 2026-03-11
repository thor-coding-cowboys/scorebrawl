import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpcClient, useTRPC, type AnyTRPC } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
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
	Add01Icon,
	UserMultiple02Icon,
	PlayIcon,
	CheckmarkCircle01Icon,
	Cancel01Icon,
	CoinsIcon,
	ArrowTurnBackwardIcon,
	Delete02Icon,
} from "@hugeicons/core-free-icons";
import { truncateSlug, debounce } from "@/lib/utils";
import { toast } from "sonner";
import type {
	SessionEventDetail,
	ScoreUpdateDetail,
	TeamSelectionUpdateDetail,
	ProposedLineupUpdateDetail,
} from "@/lib/event-types";
import { OverviewCard } from "../../../-components/season/overview-card";
import {
	fisherYatesShuffle,
	enforceAlwaysSplit,
	getPlayerBySeasonId,
	SessionDashboardCards,
	ScoreStepper,
	TeamRosterCard,
	QueueList,
	PlayerSelectionDrawer,
	CoinTossDialog,
	AddPlayerDialog,
	SessionStandings,
	type GameSession,
	type ProposedLineup,
	type TeamAssignment,
	type PlayerWithTeam,
	type SessionPlayer,
} from "./-components";

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/"
)({
	component: SessionLivePage,
});

const SSE_DEBOUNCE_THRESHOLD_MS = 500;

function SessionLivePage() {
	const { slug, seasonSlug, sessionId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const trpc = useTRPC();
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
			if (detail.type === "session:update" && detail.sessionId === sessionId) {
				queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			}
		};
		window.addEventListener("session-event", handler);
		return () => window.removeEventListener("session-event", handler);
	}, [sessionId, queryClient, navigate, slug, seasonSlug]);

	const [proposedLineup, setProposedLineup] = useState<ProposedLineup>(null);
	const [pendingCoinTossId, setPendingCoinTossId] = useState<string | null>(null);
	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);
	const [showCoinToss, setShowCoinToss] = useState(false);
	const [showAddPlayer, setShowAddPlayer] = useState(false);
	const [showPlayerDrawer, setShowPlayerDrawer] = useState(false);
	const [showUndoDialog, setShowUndoDialog] = useState(false);

	const [teamAssignment, setTeamAssignment] = useState<PlayerWithTeam[]>([]);
	const [isShuffling, setIsShuffling] = useState(false);

	const lastLocalChangeRef = useRef<number>(0);
	const lastLocalTeamChangeRef = useRef<number>(0);
	const shuffleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const allMatches = session?.matches ?? [];
	const currentMatch = allMatches.find((m) => m.result === null) ?? null;
	const currentMatchRef = useRef(currentMatch);
	currentMatchRef.current = currentMatch;

	const currentMatchId = currentMatch?.id ?? null;
	const prevMatchIdRef = useRef<string | null>(currentMatchId);
	if (currentMatchId !== prevMatchIdRef.current) {
		prevMatchIdRef.current = currentMatchId;
		setHomeScore(currentMatch?.homeSessionScore ?? 0);
		setAwayScore(currentMatch?.awaySessionScore ?? 0);
	}

	const updateHomeScore = (updater: (prev: number) => number) => {
		lastLocalChangeRef.current = Date.now();
		setHomeScore(updater);
	};

	const updateAwayScore = (updater: (prev: number) => number) => {
		lastLocalChangeRef.current = Date.now();
		setAwayScore(updater);
	};

	useEffect(() => {
		if (!session) return;
		setTeamAssignment((prev) => {
			const existingIds = new Set(prev.map((p) => p.id));
			const currentMatch = session.matches.find((m) => m.result === null);

			if (currentMatch) {
				const useSelected = !!currentMatch.selectedHomePlayerIds?.length;
				const homeIds = useSelected
					? currentMatch.selectedHomePlayerIds!
					: currentMatch.homePlayerIds;
				const awayIds = useSelected
					? currentMatch.selectedAwayPlayerIds!
					: currentMatch.awayPlayerIds;
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

			if (session.proposedLineup && !currentMatch) {
				const homeIds = session.proposedLineup.selectedHomePlayerIds?.length
					? session.proposedLineup.selectedHomePlayerIds
					: session.proposedLineup.homePlayerIds;
				const awayIds = session.proposedLineup.selectedAwayPlayerIds?.length
					? session.proposedLineup.selectedAwayPlayerIds
					: session.proposedLineup.awayPlayerIds;
				if (homeIds.length || awayIds.length) {
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
			}

			// Default: Just merge player data without changing teams
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

	useEffect(() => {
		const handler = (e: CustomEvent<ScoreUpdateDetail>) => {
			const detail = e.detail;
			const match = currentMatchRef.current;
			if (detail.sessionId === sessionId && match?.id === detail.sessionMatchId) {
				const timeSinceLocalChange = Date.now() - lastLocalChangeRef.current;
				if (timeSinceLocalChange > SSE_DEBOUNCE_THRESHOLD_MS) {
					setHomeScore(detail.homeScore);
					setAwayScore(detail.awayScore);
				}
			}
		};
		window.addEventListener("score-update", handler);
		return () => window.removeEventListener("score-update", handler);
	}, [sessionId]);

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
					sessionId,
					sessionMatchId: match.id,
					homeScore: home,
					awayScore: away,
				});
			}, 300),
		[sessionId]
	);

	useEffect(() => {
		if (!currentMatchRef.current) return;
		debouncedUpdateScore(homeScore, awayScore);
		return () => debouncedUpdateScore.cancel();
	}, [homeScore, awayScore, debouncedUpdateScore]);

	useEffect(() => {
		return () => {
			if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
		};
	}, []);

	useEffect(() => {
		const handler = (e: CustomEvent<TeamSelectionUpdateDetail>) => {
			const detail = e.detail;
			const match = currentMatchRef.current;
			if (detail.sessionId === sessionId && match?.id === detail.sessionMatchId) {
				const timeSinceLocalChange = Date.now() - lastLocalTeamChangeRef.current;
				if (timeSinceLocalChange > SSE_DEBOUNCE_THRESHOLD_MS) {
					setTeamAssignment((prev) =>
						prev.map((p) => {
							const isHome = detail.selectedHomePlayerIds.includes(p.id);
							const isAway = detail.selectedAwayPlayerIds.includes(p.id);
							return { ...p, team: isHome ? "home" : isAway ? "away" : undefined };
						})
					);
				}
			}
		};
		window.addEventListener("team-selection-update", handler);
		return () => window.removeEventListener("team-selection-update", handler);
	}, [sessionId]);

	useEffect(() => {
		const handler = (e: CustomEvent<ProposedLineupUpdateDetail>) => {
			const detail = e.detail;
			const match = currentMatchRef.current;
			if (detail.sessionId === sessionId && !match) {
				const timeSinceLocalChange = Date.now() - lastLocalTeamChangeRef.current;
				if (timeSinceLocalChange > SSE_DEBOUNCE_THRESHOLD_MS) {
					setProposedLineup(detail.proposedLineup);
					setTeamAssignment((prev) =>
						prev.map((p) => {
							const isHome = detail.proposedLineup.selectedHomePlayerIds.includes(p.id);
							const isAway = detail.proposedLineup.selectedAwayPlayerIds.includes(p.id);
							return { ...p, team: isHome ? "home" : isAway ? "away" : undefined };
						})
					);
				}
			}
		};
		window.addEventListener("proposed-lineup-update", handler);
		return () => window.removeEventListener("proposed-lineup-update", handler);
	}, [sessionId]);

	const updateTeamSelection = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			selectedHomePlayerIds: string[];
			selectedAwayPlayerIds: string[];
		}) => client.session.updateTeamSelection.mutate(input),
	});

	const updateProposedLineup = useMutation({
		mutationFn: (input: {
			sessionId: string;
			proposedLineup: {
				homePlayerIds: string[];
				awayPlayerIds: string[];
				rotatedOut: string[];
				coinTossNeeded: { conflictType: string; candidates: string[] } | null;
				selectedHomePlayerIds: string[];
				selectedAwayPlayerIds: string[];
			};
		}) => client.session.updateProposedLineup.mutate(input),
	});

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

	const startNextMatch = useMutation({
		mutationFn: (input: {
			sessionId: string;
			homeSeasonPlayerIds: string[];
			awaySeasonPlayerIds: string[];
		}) => client.session.startNextMatch.mutate(input) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			setProposedLineup(null);
			setShowPlayerDrawer(false);
		},
		onError: () => toast.error("Failed to start match"),
	});

	const recordResult = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			homeScore: number;
			awayScore: number;
		}) =>
			client.session.recordResult.mutate(input) as Promise<{
				session: GameSession;
				proposedLineup: ProposedLineup;
				coinTossId: string | null;
				autoResolvedCoinToss: { winnerNames: string[]; conflictType: string } | null;
			}>,
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.match.getLatest.queryKey({ seasonSlug }),
			});
			setHomeScore(0);
			setAwayScore(0);
			if (res.autoResolvedCoinToss) {
				const { winnerNames, conflictType } = res.autoResolvedCoinToss;
				const label = conflictType === "draw-tiebreak" ? "Draw tiebreak" : "Displacement tie";
				toast.info(`${label} resolved: ${winnerNames.join(", ")} won the coin toss`);
				if (session?.autoRandomize && res.proposedLineup) {
					triggerShuffleAnimation(() => applyRandomizedLineup(res.proposedLineup!));
				} else if (res.proposedLineup) {
					triggerShuffleAnimation(() => setProposedLineup(res.proposedLineup));
				} else {
					setProposedLineup(null);
				}
			} else if (res.proposedLineup?.coinTossNeeded) {
				triggerShuffleAnimation(() => {
					setProposedLineup(res.proposedLineup);
					setPendingCoinTossId(res.coinTossId);
					setShowCoinToss(true);
				});
			} else if (session?.autoRandomize && res.proposedLineup) {
				triggerShuffleAnimation(() => applyRandomizedLineup(res.proposedLineup!));
			} else if (res.proposedLineup) {
				triggerShuffleAnimation(() => setProposedLineup(res.proposedLineup));
			} else {
				setProposedLineup(null);
			}
		},
		onError: () => toast.error("Failed to record result"),
	});

	const applyRandomizedLineup = (lineup: NonNullable<ProposedLineup>) => {
		if (!session) return;
		const allIds = [...lineup.homePlayerIds, ...lineup.awayPlayerIds];
		const shuffled = fisherYatesShuffle(allIds);
		const teamSize = session.teamSize;
		const rawHome = shuffled.slice(0, teamSize);
		const rawAway = shuffled.slice(teamSize, teamSize * 2);
		const { homeIds: fixedHome, awayIds: fixedAway } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.alwaysSplitConstraints,
			session.players
		);
		const homeSet = new Set(fixedHome);
		const awaySet = new Set(fixedAway);
		setProposedLineup({ ...lineup, homePlayerIds: fixedHome, awayPlayerIds: fixedAway });
		setTeamAssignment((prev) =>
			prev.map((p) => ({
				...p,
				team: homeSet.has(p.id) ? "home" : awaySet.has(p.id) ? "away" : undefined,
			}))
		);
	};

	const triggerShuffleAnimation = (onComplete: () => void) => {
		if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
		setIsShuffling(true);
		setTeamAssignment((prev) => prev.map((p) => ({ ...p, team: undefined })));
		shuffleTimeoutRef.current = setTimeout(() => {
			setIsShuffling(false);
			onComplete();
		}, 600);
	};

	const resolveCoinToss = useMutation({
		mutationFn: (input: { coinTossId: string; resolvedWinnerIds: string[] }) =>
			client.session.resolveCoinToss.mutate(input) as Promise<{
				resolved: unknown;
				proposedLineup: ProposedLineup;
			}>,
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			if (res.proposedLineup) {
				setProposedLineup(res.proposedLineup);
			}
			setPendingCoinTossId(null);
			setShowCoinToss(false);
		},
		onError: () => toast.error("Failed to resolve coin toss"),
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

	const removePlayer = useMutation({
		mutationFn: (input: { sessionId: string; sessionPlayerId: string }) =>
			client.session.removePlayer.mutate(input) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			toast.success("Player removed from session");
		},
		onError: () => toast.error("Failed to remove player"),
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

	const cancelMatch = useMutation({
		mutationFn: () => client.session.cancelMatch.mutate({ sessionId }) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			setHomeScore(0);
			setAwayScore(0);
		},
		onError: () => toast.error("Failed to cancel match"),
	});

	const deleteLastMatch = useMutation({
		mutationFn: () => client.session.deleteLastMatch.mutate({ sessionId }) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.match.getLatest.queryKey({ seasonSlug }),
			});
			setShowUndoDialog(false);
			toast.success("Last match deleted");
		},
		onError: () => toast.error("Failed to delete last match"),
	});

	const handlePlayerSelect = (player: PlayerWithTeam, team: "home" | "away") => {
		lastLocalTeamChangeRef.current = Date.now();
		setTeamAssignment((prev) =>
			prev.map((p) => {
				if (p.id !== player.id) return p;
				return { ...p, team: p.team === team ? undefined : team };
			})
		);
	};

	const handleShuffle = () => {
		if (!session) return;
		lastLocalTeamChangeRef.current = Date.now();
		const available = session.players.filter((p) => p.status !== "out");
		const shuffled = fisherYatesShuffle(available);
		const rawHome = shuffled.slice(0, session.teamSize).map((p) => p.id);
		const rawAway = shuffled.slice(session.teamSize, session.teamSize * 2).map((p) => p.id);
		const { homeIds: fixedHome, awayIds: fixedAway } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.alwaysSplitConstraints,
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

	const handleEven = () => {
		if (!session) return;
		lastLocalTeamChangeRef.current = Date.now();
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
			session.alwaysSplitConstraints,
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
		lastLocalTeamChangeRef.current = Date.now();
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
				session.alwaysSplitConstraints,
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

	const canSelectTeam = !currentMatch && !coinTossActive;
	const canReorder =
		teamAssignment.filter((p) => p.team).length % 2 === 0 &&
		teamAssignment.filter((p) => p.team).length >= 2;

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

			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<SessionDashboardCards session={session} />

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
							}
						>
							{currentMatch ? (
								<div className="flex flex-col gap-4">
									<div className="bg-muted/30">
										<div className="grid grid-cols-2">
											<ScoreStepper
												label="Home"
												score={homeScore}
												onIncrement={() => updateHomeScore((s) => s + 1)}
												onDecrement={() => updateHomeScore((s) => Math.max(0, s - 1))}
											/>
											<ScoreStepper
												label="Away"
												score={awayScore}
												onIncrement={() => updateAwayScore((s) => s + 1)}
												onDecrement={() => updateAwayScore((s) => Math.max(0, s - 1))}
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<TeamRosterCard
											label="Home"
											players={currentMatch.homePlayerIds
												.map((sid) => getPlayerBySeasonId(session, sid))
												.filter((p): p is SessionPlayer => p !== undefined)}
										/>
										<TeamRosterCard
											label="Away"
											players={currentMatch.awayPlayerIds
												.map((sid) => getPlayerBySeasonId(session, sid))
												.filter((p): p is SessionPlayer => p !== undefined)}
										/>
									</div>

									<div className="flex flex-col gap-2 border-t border-border pt-4">
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
								</div>
							) : (
								<div className="flex flex-col gap-4">
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
								</div>
							)}
						</OverviewCard>

						<OverviewCard
							title="Players"
							action={
								<Badge variant="secondary" className="text-xs">
									{session.players.length}
								</Badge>
							}
						>
							<QueueList
								session={session}
								onRemovePlayer={(sessionPlayerId) =>
									removePlayer.mutate({ sessionId, sessionPlayerId })
								}
								isRemoving={removePlayer.isPending}
							/>
							{session.alwaysSplitConstraints.length > 0 && (
								<div className="mt-3 text-xs text-muted-foreground space-y-1">
									<span className="font-medium text-foreground text-sm">Always Split</span>
									{session.alwaysSplitConstraints.map(([a, b]) => {
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
						</OverviewCard>
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

			{canSelectTeam && (
				<PlayerSelectionDrawer
					isOpen={showPlayerDrawer}
					onClose={() => {
						saveTeamSelection();
						setShowPlayerDrawer(false);
					}}
					session={session}
					teamAssignment={teamAssignment}
					onSelect={handlePlayerSelect}
					onShuffle={handleShuffle}
					onEven={handleEven}
					onRotation={handleRotation}
					canReorder={canReorder}
					isFirstMatch={allMatches.length === 0}
				/>
			)}

			<CoinTossDialog
				open={showCoinToss}
				onOpenChange={setShowCoinToss}
				candidates={coinTossCandidates}
				session={session}
				onResolve={handleCoinResolve}
			/>

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
