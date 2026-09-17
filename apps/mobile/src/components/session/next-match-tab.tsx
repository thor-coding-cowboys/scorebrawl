import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	Alert,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui/card";
import { QueueList } from "@/components/session/queue-tab";
import { useSessionTheme } from "@/components/session/theme";
import type { GameSession, PlayerWithTeam, SessionPlayer } from "@/components/session/types";
import {
	enforceAlwaysSplit,
	fisherYatesShuffle,
	getPlayerBySeasonId,
} from "@/components/session/utils";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Fonts, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

type Team = "home" | "away";

export function NextMatchTab({
	session,
	sessionId,
	seasonSlug,
	refresh,
}: {
	session: GameSession;
	sessionId: string;
	seasonSlug: string;
	refresh: () => Promise<unknown>;
}) {
	const { refreshing, onRefresh } = usePullToRefresh(refresh);
	const sessionTheme = useSessionTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [teamAssignment, setTeamAssignment] = useState<PlayerWithTeam[]>([]);
	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);
	const [showTeamEditor, setShowTeamEditor] = useState(false);
	const [showCoinToss, setShowCoinToss] = useState(false);
	const [busy, setBusy] = useState(false);
	const prevMatchIdRef = useRef<string | null>(null);

	const currentMatch = session.matches.find((m) => m.result === null) ?? null;
	const completedCount = session.matches.filter((m) => m.result !== null).length;
	const pendingCoinToss = session.pendingCoinTosses[0] ?? null;
	const coinTossCandidates =
		pendingCoinToss?.candidates ?? session.proposedLineup?.coinTossNeeded?.candidates ?? [];
	const coinTossActive = !!pendingCoinToss;

	useEffect(() => {
		setTeamAssignment((prev) =>
			session.players.map((p) => {
				const existing = prev.find((e) => e.id === p.id);
				const base = existing ? { ...existing, ...p } : { ...p, team: undefined };

				const activeMatch = session.matches.find((m) => m.result === null) ?? null;
				if (activeMatch) {
					const useSelected = !!activeMatch.selectedHomePlayerIds?.length;
					const homeIds = useSelected
						? activeMatch.selectedHomePlayerIds!
						: activeMatch.homePlayerIds;
					const awayIds = useSelected
						? activeMatch.selectedAwayPlayerIds!
						: activeMatch.awayPlayerIds;
					const key = useSelected ? p.id : p.seasonPlayerId;
					return {
						...base,
						team: homeIds.includes(key) ? "home" : awayIds.includes(key) ? "away" : undefined,
					};
				}

				if (session.proposedLineup) {
					const homeIds = session.proposedLineup.selectedHomePlayerIds?.length
						? session.proposedLineup.selectedHomePlayerIds
						: session.proposedLineup.homePlayerIds;
					const awayIds = session.proposedLineup.selectedAwayPlayerIds?.length
						? session.proposedLineup.selectedAwayPlayerIds
						: session.proposedLineup.awayPlayerIds;
					return {
						...base,
						team: homeIds.includes(p.id) ? "home" : awayIds.includes(p.id) ? "away" : undefined,
					};
				}

				return base;
			})
		);
	}, [session]);

	useEffect(() => {
		const id = currentMatch?.id ?? null;
		if (id !== prevMatchIdRef.current) {
			prevMatchIdRef.current = id;
			setHomeScore(currentMatch?.homeSessionScore ?? 0);
			setAwayScore(currentMatch?.awaySessionScore ?? 0);
		}
	}, [currentMatch]);

	const homePlayers = teamAssignment.filter((p) => p.team === "home");
	const awayPlayers = teamAssignment.filter((p) => p.team === "away");
	const teamsBalanced =
		homePlayers.length === awayPlayers.length &&
		homePlayers.length > 0 &&
		homePlayers.length === session.teamSize;

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.session.getById.queryKey({ sessionId }) });
	const invalidateStandings = () => {
		queryClient.invalidateQueries({
			queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.match.getAll.queryKey({ seasonSlug, limit: 30, offset: 0 }),
		});
	};

	const applyTeams = (homeIds: string[], awayIds: string[]) => {
		setTeamAssignment((prev) =>
			prev.map((p) => ({
				...p,
				team: homeIds.includes(p.id) ? "home" : awayIds.includes(p.id) ? "away" : undefined,
			}))
		);
	};

	const shuffleAll = () => {
		const eligible = teamAssignment.filter((p) => p.status !== "out");
		const shuffled = fisherYatesShuffle(eligible);
		const rawHome = shuffled.slice(0, session.teamSize).map((p) => p.id);
		const rawAway = shuffled.slice(session.teamSize, session.teamSize * 2).map((p) => p.id);
		const { homeIds, awayIds } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.alwaysSplitConstraints,
			teamAssignment
		);
		applyTeams(homeIds, awayIds);
	};

	const shuffleSelected = () => {
		const selected = teamAssignment.filter((p) => p.team);
		const shuffled = fisherYatesShuffle(selected);
		const rawHome = shuffled.slice(0, session.teamSize).map((p) => p.id);
		const rawAway = shuffled.slice(session.teamSize, session.teamSize * 2).map((p) => p.id);
		const { homeIds, awayIds } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.alwaysSplitConstraints,
			teamAssignment
		);
		applyTeams(homeIds, awayIds);
	};

	const evenTeams = () => {
		const eligible = teamAssignment.filter((p) => p.status !== "out");
		const sorted = [...eligible].sort((a, b) => b.score - a.score);
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
		const { homeIds, awayIds } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.alwaysSplitConstraints,
			teamAssignment
		);
		applyTeams(homeIds, awayIds);
	};

	const rotationTeams = () => {
		const lineup = session.proposedLineup;
		if (lineup && (lineup.homePlayerIds.length || lineup.awayPlayerIds.length)) {
			applyTeams(lineup.homePlayerIds, lineup.awayPlayerIds);
			return;
		}
		const eligible = teamAssignment
			.filter((p) => p.status !== "out")
			.sort((a, b) => a.queuePosition - b.queuePosition);
		const rawHome = eligible.slice(0, session.teamSize).map((p) => p.id);
		const rawAway = eligible.slice(session.teamSize, session.teamSize * 2).map((p) => p.id);
		const { homeIds, awayIds } = enforceAlwaysSplit(
			rawHome,
			rawAway,
			session.alwaysSplitConstraints,
			teamAssignment
		);
		applyTeams(homeIds, awayIds);
	};

	const saveTeamSelection = () => {
		const homeIds = teamAssignment.filter((p) => p.team === "home").map((p) => p.id);
		const awayIds = teamAssignment.filter((p) => p.team === "away").map((p) => p.id);
		const lineup = session.proposedLineup ?? {
			homePlayerIds: [],
			awayPlayerIds: [],
			rotatedOut: [],
			coinTossNeeded: null,
		};
		trpcClient.session.updateProposedLineup
			.mutate({
				sessionId,
				proposedLineup: {
					...lineup,
					selectedHomePlayerIds: homeIds,
					selectedAwayPlayerIds: awayIds,
				},
			})
			.then(invalidate)
			.catch(() => undefined);
	};

	const startMatch = async () => {
		setBusy(true);
		try {
			await trpcClient.session.startNextMatch.mutate({
				sessionId,
				homeSeasonPlayerIds: homePlayers.map((p) => p.seasonPlayerId),
				awaySeasonPlayerIds: awayPlayers.map((p) => p.seasonPlayerId),
			});
			invalidate();
		} finally {
			setBusy(false);
		}
	};

	const recordResult = async () => {
		if (!currentMatch) return;
		setBusy(true);
		try {
			await trpcClient.session.recordResult.mutate({
				sessionId,
				sessionMatchId: currentMatch.id,
				homeScore,
				awayScore,
			});
			invalidate();
			invalidateStandings();
		} finally {
			setBusy(false);
		}
	};

	const cancelMatch = async () => {
		setBusy(true);
		try {
			await trpcClient.session.cancelMatch.mutate({ sessionId });
			invalidate();
		} finally {
			setBusy(false);
		}
	};

	const undoLastMatch = () => {
		Alert.alert(
			"Undo last match?",
			"This will delete the last recorded match and revert all scores and stats.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Undo Match",
					style: "destructive",
					onPress: async () => {
						setBusy(true);
						try {
							await trpcClient.session.deleteLastMatch.mutate({ sessionId });
							invalidate();
							invalidateStandings();
						} finally {
							setBusy(false);
						}
					},
				},
			]
		);
	};

	const resolveCoinToss = async (winnerId: string) => {
		if (!pendingCoinToss) return;
		setShowCoinToss(false);
		setBusy(true);
		try {
			await trpcClient.session.resolveCoinToss.mutate({
				coinTossId: pendingCoinToss.id,
				resolvedWinnerIds: [winnerId],
			});
			invalidate();
		} finally {
			setBusy(false);
		}
	};

	const currentHome = currentMatch
		? currentMatch.homePlayerIds
				.map((id) => getPlayerBySeasonId(session, id))
				.filter((p): p is SessionPlayer => !!p)
		: [];
	const currentAway = currentMatch
		? currentMatch.awayPlayerIds
				.map((id) => getPlayerBySeasonId(session, id))
				.filter((p): p is SessionPlayer => !!p)
		: [];

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={styles.content}
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
		>
			<Card
				style={[
					styles.card,
					{ backgroundColor: sessionTheme.cardBg, borderColor: sessionTheme.border },
				]}
			>
				<View style={styles.cardHeader}>
					<ThemedText type="smallBold">
						{currentMatch ? `Match #${currentMatch.matchNumber}` : "Next Match"}
					</ThemedText>
					<View style={styles.headerRight}>
						{currentMatch ? (
							<View style={[styles.badge, { borderColor: sessionTheme.border }]}>
								<ThemedText themeColor="textSecondary" style={styles.headerMeta}>
									In Progress
								</ThemedText>
							</View>
						) : (
							<ThemedText themeColor="textSecondary" style={styles.headerMeta}>
								{completedCount} played
							</ThemedText>
						)}
						{coinTossActive && !currentMatch ? (
							<Button
								variant="glow"
								size="sm"
								icon={{ ios: "dollarsign.circle", android: "toll", web: "toll" }}
								onPress={() => setShowCoinToss(true)}
							>
								Coin Toss
							</Button>
						) : null}
					</View>
				</View>

				<View style={styles.body}>
					<View style={styles.scoreBoard}>
						<ScoreStepper
							label="Home"
							score={homeScore}
							disabled={!currentMatch}
							onIncrement={() => setHomeScore((s) => s + 1)}
							onDecrement={() => setHomeScore((s) => Math.max(0, s - 1))}
						/>
						<View style={[styles.scoreDivider, { backgroundColor: sessionTheme.border }]} />
						<ScoreStepper
							label="Away"
							score={awayScore}
							disabled={!currentMatch}
							onIncrement={() => setAwayScore((s) => s + 1)}
							onDecrement={() => setAwayScore((s) => Math.max(0, s - 1))}
						/>
					</View>

					{currentMatch ? (
						<>
							<View style={styles.rosters}>
								<TeamRosterCard label="Home" players={currentHome} />
								<TeamRosterCard label="Away" players={currentAway} />
							</View>
							<View style={styles.stack}>
								<Button
									variant="glow"
									fullWidth
									icon={{ ios: "checkmark.circle", android: "check_circle", web: "check_circle" }}
									onPress={recordResult}
									loading={busy}
								>
									Record Result
								</Button>
								<Button
									variant="ghost"
									fullWidth
									icon={{ ios: "arrow.uturn.backward", android: "undo", web: "undo" }}
									onPress={cancelMatch}
									disabled={busy}
								>
									Cancel Match
								</Button>
							</View>
						</>
					) : (
						<>
							<View style={styles.rosters}>
								<TeamRosterCard
									label="Home"
									players={homePlayers}
									emptyHint={`${session.teamSize} player${session.teamSize !== 1 ? "s" : ""}`}
								/>
								<TeamRosterCard
									label="Away"
									players={awayPlayers}
									emptyHint={`${session.teamSize} player${session.teamSize !== 1 ? "s" : ""}`}
								/>
							</View>
							<View style={styles.stack}>
								<Button
									variant="outline"
									fullWidth
									icon={{ ios: "person.3", android: "groups", web: "groups" }}
									onPress={() => setShowTeamEditor(true)}
								>
									Select Players
								</Button>
								<Button
									variant="glow"
									fullWidth
									icon={{ ios: "play.fill", android: "play_arrow", web: "play_arrow" }}
									onPress={startMatch}
									loading={busy}
									disabled={!teamsBalanced || homePlayers.length !== session.teamSize}
								>
									Start Match
								</Button>
								{completedCount > 0 ? (
									<Button
										variant="ghost"
										size="sm"
										fullWidth
										icon={{ ios: "trash", android: "delete", web: "delete" }}
										onPress={undoLastMatch}
										disabled={busy}
									>
										Undo Last Match
									</Button>
								) : null}
							</View>
						</>
					)}
				</View>
			</Card>

			<Card
				style={[
					styles.card,
					{ backgroundColor: sessionTheme.cardBg, borderColor: sessionTheme.border },
				]}
			>
				<ThemedText type="smallBold" style={styles.playersHeading}>
					Players
				</ThemedText>
				<QueueList session={session} sessionId={sessionId} />
				{session.alwaysSplitConstraints.length > 0 ? (
					<View style={styles.alwaysSplit}>
						<ThemedText type="smallBold">Always Split</ThemedText>
						{session.alwaysSplitConstraints.map(([a, b]) => {
							const pA = session.players.find((p) => p.seasonPlayerId === a);
							const pB = session.players.find((p) => p.seasonPlayerId === b);
							if (!pA || !pB) return null;
							return (
								<ThemedText key={`${a}-${b}`} type="small" themeColor="textSecondary">
									{pA.displayName} / {pB.displayName}
								</ThemedText>
							);
						})}
					</View>
				) : null}
			</Card>

			<TeamEditorModal
				isOpen={showTeamEditor}
				onClose={() => {
					saveTeamSelection();
					setShowTeamEditor(false);
				}}
				players={teamAssignment}
				teamSize={session.teamSize}
				onAssign={(player) =>
					setTeamAssignment((prev) =>
						prev.map((p) => (p.id === player.id ? { ...p, team: player.team } : p))
					)
				}
				onShuffle={shuffleAll}
				onShuffleSelected={shuffleSelected}
				onEven={evenTeams}
				onRotation={rotationTeams}
			/>

			<CoinTossModal
				isOpen={showCoinToss}
				onClose={() => setShowCoinToss(false)}
				candidates={coinTossCandidates}
				session={session}
				onResolve={resolveCoinToss}
			/>
		</ScrollView>
	);
}

function ScoreStepper({
	label,
	score,
	disabled,
	onIncrement,
	onDecrement,
}: {
	label: string;
	score: number;
	disabled?: boolean;
	onIncrement: () => void;
	onDecrement: () => void;
}) {
	return (
		<View style={[styles.stepper, disabled && styles.disabled]}>
			<ThemedText themeColor="textSecondary" style={styles.stepperLabel}>
				{label}
			</ThemedText>
			<View style={styles.stepperControls}>
				<Button
					variant="outline"
					size="iconSm"
					icon={{ ios: "minus", android: "remove", web: "remove" }}
					onPress={onDecrement}
					disabled={disabled || score <= 0}
				/>
				<ThemedText style={styles.stepperValue}>{score}</ThemedText>
				<Button
					variant="outline"
					size="iconSm"
					icon={{ ios: "plus", android: "add", web: "add" }}
					onPress={onIncrement}
					disabled={disabled}
				/>
			</View>
		</View>
	);
}

function TeamRosterCard({
	label,
	players,
	emptyHint,
}: {
	label: string;
	players: SessionPlayer[];
	emptyHint?: string;
}) {
	const sessionTheme = useSessionTheme();
	return (
		<View style={[styles.roster, { borderColor: sessionTheme.border }]}>
			<View
				style={[
					styles.rosterHeader,
					{ borderBottomColor: sessionTheme.border, backgroundColor: sessionTheme.mutedBg },
				]}
			>
				<ThemedText themeColor="textSecondary" style={styles.rosterLabel}>
					{label}
				</ThemedText>
				<ThemedText themeColor="textSecondary" style={styles.rosterCount}>
					{players.length}p
				</ThemedText>
			</View>
			<View style={styles.rosterBody}>
				{players.length === 0 ? (
					<View style={styles.rosterEmpty}>
						<ThemedText type="small" themeColor="textSecondary">
							{emptyHint ?? "No players"}
						</ThemedText>
					</View>
				) : (
					players.map((p) => (
						<View key={p.id} style={styles.rosterRow}>
							<Avatar name={p.displayName} image={getAvatarUri(p.playerImage)} size={24} />
							<View style={styles.rosterInfo}>
								<ThemedText style={styles.rosterName} numberOfLines={1}>
									{p.displayName}
								</ThemedText>
								<ThemedText themeColor="textSecondary" style={styles.rosterScore}>
									{p.score}
								</ThemedText>
							</View>
						</View>
					))
				)}
			</View>
		</View>
	);
}

function CoinTossModal({
	isOpen,
	onClose,
	candidates,
	session,
	onResolve,
}: {
	isOpen: boolean;
	onClose: () => void;
	candidates: string[];
	session: GameSession;
	onResolve: (winnerId: string) => void;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const [phase, setPhase] = useState<"pick" | "flip" | "result">("pick");
	const [choice, setChoice] = useState<"heads" | "tails" | null>(null);
	const [winnerId, setWinnerId] = useState<string | null>(null);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	useEffect(() => {
		if (isOpen) {
			setPhase("pick");
			setChoice(null);
			setWinnerId(null);
			timersRef.current.forEach(clearTimeout);
			timersRef.current = [];
		}
	}, [isOpen]);

	const picker = session.players.find((p) => p.id === candidates[0]);
	const winner = winnerId ? session.players.find((p) => p.id === winnerId) : null;

	const pick = (side: "heads" | "tails") => {
		setChoice(side);
		setPhase("flip");
		const actual = candidates[Math.floor(Math.random() * candidates.length)];
		timersRef.current.push(
			setTimeout(() => {
				setWinnerId(actual);
				setPhase("result");
				timersRef.current.push(setTimeout(() => onResolve(actual), 1800));
			}, 1600)
		);
	};

	return (
		<Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
			<View style={styles.coinOverlay}>
				<ThemedView style={[styles.coinSheet, { paddingBottom: insets.bottom + Spacing.four }]}>
					<View style={styles.coinHeader}>
						<ThemedText type="subtitle">Coin Toss</ThemedText>
						<ModalCloseButton onPress={onClose} />
					</View>
					{phase === "pick" ? (
						<View style={styles.coinBody}>
							<ThemedText type="small" themeColor="textSecondary">
								{picker?.displayName ?? "Player"} calls it
							</ThemedText>
							<View style={styles.coinChoices}>
								<Button
									variant="outline"
									size="icon"
									icon={{ ios: "circle", android: "circle", web: "circle" }}
									onPress={() => pick("heads")}
								/>
								<Button
									variant="outline"
									size="icon"
									icon={{ ios: "circle.dashed", android: "circle", web: "circle" }}
									onPress={() => pick("tails")}
								/>
							</View>
							<View style={styles.coinChoiceLabels}>
								<ThemedText type="small">Heads</ThemedText>
								<ThemedText type="small">Tails</ThemedText>
							</View>
						</View>
					) : phase === "flip" ? (
						<View style={styles.coinBody}>
							<ThemedText type="smallBold" style={{ color: theme.primary }}>
								You chose {choice}
							</ThemedText>
							<ThemedText type="small" themeColor="textSecondary">
								Flipping…
							</ThemedText>
						</View>
					) : (
						<View style={styles.coinBody}>
							<ThemedText type="small" themeColor="textSecondary">
								Winner
							</ThemedText>
							<View style={styles.coinWinner}>
								{winner ? (
									<>
										<Avatar
											name={winner.displayName}
											image={getAvatarUri(winner.playerImage)}
											size={40}
										/>
										<ThemedText type="smallBold">{winner.displayName}</ThemedText>
									</>
								) : null}
							</View>
						</View>
					)}
				</ThemedView>
			</View>
		</Modal>
	);
}

function TeamEditorModal({
	isOpen,
	onClose,
	players,
	teamSize,
	onAssign,
	onShuffle,
	onShuffleSelected,
	onEven,
	onRotation,
}: {
	isOpen: boolean;
	onClose: () => void;
	players: PlayerWithTeam[];
	teamSize: number;
	onAssign: (player: { id: string; team: Team | undefined }) => void;
	onShuffle: () => void;
	onShuffleSelected: () => void;
	onEven: () => void;
	onRotation: () => void;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const eligible = players.filter((p) => p.status !== "out");
	const selectedCount = players.filter((p) => p.team).length;
	const canReorder = selectedCount >= 2 && selectedCount % 2 === 0;

	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.flex}>
				<View
					style={[
						styles.editorContent,
						{ paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.two },
					]}
				>
					<View style={styles.editorHeader}>
						<ThemedText type="subtitle">Select Players</ThemedText>
						<ModalCloseButton onPress={onClose} />
					</View>
					<View style={[styles.columns, { borderColor: theme.border }]}>
						<EditorColumn
							team="home"
							label="Home"
							players={eligible}
							teamSize={teamSize}
							onAssign={onAssign}
						/>
						<EditorColumn
							team="away"
							label="Away"
							players={eligible}
							teamSize={teamSize}
							onAssign={onAssign}
							borderLeft
						/>
					</View>
					<View style={styles.stack}>
						<Button
							variant="outline"
							fullWidth
							icon={{ ios: "shuffle", android: "shuffle", web: "shuffle" }}
							onPress={onShuffle}
						>
							Shuffle
						</Button>
						<Button
							variant="outline"
							fullWidth
							icon={{ ios: "shuffle", android: "shuffle", web: "shuffle" }}
							onPress={onShuffleSelected}
							disabled={!canReorder}
						>
							Shuffle Selected
						</Button>
						<Button
							variant="outline"
							fullWidth
							icon={{ ios: "scalemass", android: "balance", web: "balance" }}
							onPress={onEven}
							disabled={!canReorder}
						>
							Even
						</Button>
						<Button
							variant="outline"
							fullWidth
							icon={{ ios: "arrow.clockwise", android: "refresh", web: "refresh" }}
							onPress={onRotation}
						>
							Rotation
						</Button>
						<Button
							variant="glow"
							fullWidth
							icon={{ ios: "checkmark", android: "check", web: "check" }}
							onPress={onClose}
						>
							Done
						</Button>
					</View>
				</View>
			</ThemedView>
		</Modal>
	);
}

function EditorColumn({
	team,
	label,
	players,
	teamSize,
	onAssign,
	borderLeft,
}: {
	team: Team;
	label: string;
	players: PlayerWithTeam[];
	teamSize: number;
	onAssign: (player: { id: string; team: Team | undefined }) => void;
	borderLeft?: boolean;
}) {
	const theme = useTheme();
	const onThisTeam = players.filter((p) => p.team === team);
	return (
		<View
			style={[
				styles.column,
				borderLeft && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border },
			]}
		>
			<View style={[styles.columnHeader, { borderBottomColor: theme.border }]}>
				<ThemedText type="small" themeColor="textSecondary">
					{label.toUpperCase()} ({onThisTeam.length}/{teamSize})
				</ThemedText>
			</View>
			<ScrollView style={styles.columnScroll}>
				{players.map((player) => {
					const assigned = player.team === team;
					return (
						<Pressable
							key={player.id}
							onPress={() => onAssign({ id: player.id, team: assigned ? undefined : team })}
							style={[
								styles.editorRow,
								{ borderBottomColor: theme.border },
								assigned && { backgroundColor: theme.backgroundElement },
							]}
						>
							<Avatar
								name={player.displayName}
								image={getAvatarUri(player.playerImage)}
								size={22}
							/>
							<ThemedText type="small" style={styles.flex} numberOfLines={1}>
								{player.displayName}
							</ThemedText>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { paddingBottom: Spacing.four, gap: Spacing.three },
	card: { padding: Spacing.three, gap: Spacing.three },
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	headerRight: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
	headerMeta: { fontSize: 12, lineHeight: 16 },
	badge: {
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.two,
		paddingVertical: 2,
	},
	body: { gap: Spacing.three },
	scoreBoard: { flexDirection: "row", alignItems: "stretch" },
	scoreDivider: { width: StyleSheet.hairlineWidth },
	stepper: {
		flex: 1,
		alignItems: "center",
		gap: 4,
		padding: 16,
	},
	disabled: { opacity: 0.5 },
	stepperLabel: {
		fontSize: 11,
		lineHeight: 14,
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	stepperControls: { flexDirection: "row", alignItems: "center", gap: 12 },
	stepperValue: {
		fontSize: 48,
		lineHeight: 48,
		fontWeight: "700",
		width: 64,
		textAlign: "center",
		letterSpacing: -1.5,
		fontVariant: ["tabular-nums"],
		fontFamily: Fonts.sans,
	},
	rosters: { flexDirection: "row", gap: Spacing.three },
	roster: { flex: 1, borderWidth: StyleSheet.hairlineWidth },
	rosterHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rosterLabel: {
		fontSize: 12,
		lineHeight: 16,
		fontWeight: "400",
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	rosterCount: { fontSize: 12, lineHeight: 16 },
	rosterBody: { minHeight: 96, padding: 8, gap: 4 },
	rosterEmpty: { flex: 1, minHeight: 80, alignItems: "center", justifyContent: "center" },
	rosterRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 4,
		paddingVertical: 2,
	},
	rosterInfo: { flex: 1, gap: 1 },
	rosterName: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
	rosterScore: { fontSize: 11, lineHeight: 14 },
	stack: { gap: Spacing.two },
	playersHeading: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
	alwaysSplit: { marginTop: Spacing.three, gap: 2 },
	coinOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
	coinSheet: {
		paddingHorizontal: Spacing.four,
		paddingTop: Spacing.four,
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
	},
	coinHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.four,
	},
	coinBody: { alignItems: "center", gap: Spacing.three, paddingBottom: Spacing.four },
	coinChoices: { flexDirection: "row", gap: Spacing.four },
	coinChoiceLabels: { flexDirection: "row", gap: Spacing.six },
	coinWinner: { alignItems: "center", gap: Spacing.two },
	flex: { flex: 1 },
	editorContent: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
	editorHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	columns: { flex: 1, flexDirection: "row", borderWidth: StyleSheet.hairlineWidth },
	column: { flex: 1 },
	columnHeader: {
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	columnScroll: { flex: 1 },
	editorRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
});
