import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

type Team = "home" | "away";

interface SelectablePlayer {
	id: string;
	name: string;
	image: string | null;
	score: number;
	team?: Team;
}

interface CreateMatchModalProps {
	isOpen: boolean;
	onClose: () => void;
	seasonSlug: string;
	season: { startDate: Date; endDate: Date | null } | null | undefined;
}

function isSeasonActive(season: CreateMatchModalProps["season"]) {
	if (!season) return true;
	const now = new Date();
	const start = new Date(season.startDate);
	if (season.endDate) {
		const end = new Date(season.endDate);
		return now >= start && now <= end;
	}
	return now >= start;
}

export function CreateMatchModal({ isOpen, onClose, seasonSlug, season }: CreateMatchModalProps) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [players, setPlayers] = useState<SelectablePlayer[]>([]);
	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);
	const [keepOpen, setKeepOpen] = useState(false);
	const [keepPlayers, setKeepPlayers] = useState(false);
	const [duplicateWarning, setDuplicateWarning] = useState(false);
	const [isSelectOpen, setIsSelectOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [initialized, setInitialized] = useState(false);
	const [error, setError] = useState("");

	const standingQuery = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));
	const latestQuery = useQuery(trpc.match.getAll.queryOptions({ seasonSlug, limit: 1, offset: 0 }));

	useEffect(() => {
		if (isOpen && standingQuery.data && !initialized) {
			setPlayers(
				standingQuery.data.map((p) => ({
					id: p.id,
					name: p.name,
					image: getAvatarUri(p.image) ?? null,
					score: p.score,
				}))
			);
			setHomeScore(0);
			setAwayScore(0);
			setDuplicateWarning(false);
			setError("");
			setInitialized(true);
		}
	}, [isOpen, standingQuery.data, initialized]);

	useEffect(() => {
		if (!isOpen) {
			setKeepOpen(false);
			setKeepPlayers(false);
			setIsSelectOpen(false);
			setInitialized(false);
		}
	}, [isOpen]);

	const homePlayers = players.filter((p) => p.team === "home");
	const awayPlayers = players.filter((p) => p.team === "away");
	const selectedCount = homePlayers.length + awayPlayers.length;
	const canReorder =
		selectedCount > 0 && selectedCount % 2 === 0 && homePlayers.length === awayPlayers.length;

	const teamsValid = homePlayers.length > 0 && homePlayers.length === awayPlayers.length;

	const assignTeam = (playerId: string, team: Team) => {
		setDuplicateWarning(false);
		setPlayers((prev) =>
			prev.map((p) => (p.id === playerId ? { ...p, team: p.team === team ? undefined : team } : p))
		);
	};

	const shuffleTeams = () => {
		const selected = players.filter((p) => p.team);
		const shuffled = [...selected];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		const half = Math.floor(shuffled.length / 2);
		const homeIds = new Set(shuffled.slice(0, half).map((p) => p.id));
		const awayIds = new Set(shuffled.slice(half).map((p) => p.id));
		setPlayers((prev) =>
			prev.map((p) => ({
				...p,
				team: homeIds.has(p.id) ? "home" : awayIds.has(p.id) ? "away" : undefined,
			}))
		);
	};

	const evenTeams = () => {
		const selected = players.filter((p) => p.team).sort((a, b) => b.score - a.score);
		const homeIds = new Set<string>();
		const awayIds = new Set<string>();
		let homeTotal = 0;
		let awayTotal = 0;
		for (const player of selected) {
			if (homeTotal <= awayTotal) {
				homeIds.add(player.id);
				homeTotal += player.score;
			} else {
				awayIds.add(player.id);
				awayTotal += player.score;
			}
		}
		setPlayers((prev) =>
			prev.map((p) => ({
				...p,
				team: homeIds.has(p.id) ? "home" : awayIds.has(p.id) ? "away" : undefined,
			}))
		);
	};

	const isDuplicate = () => {
		const latest = latestQuery.data?.matches?.[0];
		if (!latest) return false;
		const key = (ids: string[]) => [...ids].sort().join(",");
		const latestHome = latest.homeTeam.players.map((p) => p.seasonPlayerId);
		const latestAway = latest.awayTeam.players.map((p) => p.seasonPlayerId);
		const mineHome = homePlayers.map((p) => p.id);
		const mineAway = awayPlayers.map((p) => p.id);
		const same = (a: string[], b: string[]) => key(a) === key(b);
		return (
			(same(mineHome, latestHome) &&
				same(mineAway, latestAway) &&
				homeScore === latest.homeScore &&
				awayScore === latest.awayScore) ||
			(same(mineHome, latestAway) &&
				same(mineAway, latestHome) &&
				homeScore === latest.awayScore &&
				awayScore === latest.homeScore)
		);
	};

	const invalidate = () => {
		queryClient.invalidateQueries({
			queryKey: trpc.match.getAll.queryKey({ seasonSlug, limit: 30, offset: 0 }),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.match.getAll.queryKey({ seasonSlug, limit: 1, offset: 0 }),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
		});
	};

	const submit = async () => {
		if (!teamsValid || isSubmitting) return;
		if (!duplicateWarning && isDuplicate()) {
			setDuplicateWarning(true);
			return;
		}
		setDuplicateWarning(false);
		setIsSubmitting(true);
		setError("");
		try {
			await trpcClient.match.create.mutate({
				seasonSlug,
				homeScore,
				awayScore,
				homeTeamPlayerIds: homePlayers.map((p) => p.id),
				awayTeamPlayerIds: awayPlayers.map((p) => p.id),
			});
			invalidate();
			if (keepOpen) {
				setHomeScore(0);
				setAwayScore(0);
				if (!keepPlayers) setPlayers((prev) => prev.map((p) => ({ ...p, team: undefined })));
			} else {
				onClose();
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create match");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = () => {
		if (isSubmitting) return;
		onClose();
	};

	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={handleClose}>
			<ThemedView style={styles.flex}>
				<View
					style={[
						styles.content,
						{ paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.two },
					]}
				>
					<View style={styles.header}>
						<View style={styles.titleRow}>
							<View style={[styles.accent, { backgroundColor: theme.glowBlueText }]} />
							<ThemedText type="subtitle">Create Match</ThemedText>
						</View>
						<ModalCloseButton onPress={handleClose} />
					</View>

					<ScrollView
						style={styles.scroll}
						contentContainerStyle={styles.form}
						keyboardShouldPersistTaps="handled"
					>
						<View style={[styles.stepperRow, { backgroundColor: theme.backgroundElement }]}>
							<ScoreStepper
								label="Home"
								score={homeScore}
								onDecrement={() => {
									setDuplicateWarning(false);
									setHomeScore((s) => Math.max(0, s - 1));
								}}
								onIncrement={() => {
									setDuplicateWarning(false);
									setHomeScore((s) => s + 1);
								}}
							/>
							<ScoreStepper
								label="Away"
								score={awayScore}
								onDecrement={() => {
									setDuplicateWarning(false);
									setAwayScore((s) => Math.max(0, s - 1));
								}}
								onIncrement={() => {
									setDuplicateWarning(false);
									setAwayScore((s) => s + 1);
								}}
							/>
						</View>

						<View style={styles.rosters}>
							<RosterCard label="Home" players={homePlayers} />
							<RosterCard label="Away" players={awayPlayers} />
						</View>

						<Button variant="outline" onPress={() => setIsSelectOpen(true)}>
							Select Players
						</Button>

						<View style={styles.messages}>
							{!teamsValid && selectedCount > 0 ? (
								<Warning text="Teams must have equal number of players (at least 1 each)" />
							) : null}
							{!isSeasonActive(season) ? <Warning text="Season is not currently active" /> : null}
							{duplicateWarning ? (
								<Warning text="Possible duplicate — same players and score as the latest match. Press again to confirm." />
							) : null}
							{error ? (
								<ThemedText type="small" style={{ color: theme.destructive }}>
									{error}
								</ThemedText>
							) : null}
						</View>

						<View style={[styles.actions, { borderTopColor: theme.border }]}>
							<View style={styles.checks}>
								<CheckRow
									label="Keep open"
									value={keepOpen}
									onToggle={() => setKeepOpen((v) => !v)}
								/>
								<CheckRow
									label="Keep players"
									value={keepPlayers}
									onToggle={() => setKeepPlayers((v) => !v)}
								/>
							</View>
							<View style={styles.actionRow}>
								<Button variant="outline" onPress={handleClose}>
									Cancel
								</Button>
								<Button
									style={styles.submit}
									onPress={submit}
									loading={isSubmitting}
									disabled={!teamsValid}
								>
									{duplicateWarning ? "Create Anyway" : "Create Match"}
								</Button>
							</View>
						</View>
					</ScrollView>
				</View>

				<PlayerSelectionModal
					isOpen={isSelectOpen}
					onClose={() => setIsSelectOpen(false)}
					players={players}
					onAssign={assignTeam}
					onShuffle={shuffleTeams}
					onEven={evenTeams}
					canReorder={canReorder}
				/>
			</ThemedView>
		</Modal>
	);
}

function ScoreStepper({
	label,
	score,
	onIncrement,
	onDecrement,
}: {
	label: string;
	score: number;
	onIncrement: () => void;
	onDecrement: () => void;
}) {
	return (
		<View style={styles.stepper}>
			<ThemedText type="small" themeColor="textSecondary">
				{label}
			</ThemedText>
			<View style={styles.stepperControls}>
				<Button variant="outline" size="sm" onPress={onDecrement} disabled={score <= 0}>
					−
				</Button>
				<ThemedText style={styles.stepperValue}>{score}</ThemedText>
				<Button variant="outline" size="sm" onPress={onIncrement}>
					+
				</Button>
			</View>
		</View>
	);
}

function RosterCard({ label, players }: { label: string; players: SelectablePlayer[] }) {
	const theme = useTheme();
	return (
		<View style={[styles.roster, { borderColor: theme.border }]}>
			<View style={[styles.rosterHeader, { borderBottomColor: theme.border }]}>
				<ThemedText type="small" themeColor="textSecondary">
					{label.toUpperCase()}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					{players.length}
				</ThemedText>
			</View>
			<View style={styles.rosterBody}>
				{players.length === 0 ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.rosterEmpty}>
						No players
					</ThemedText>
				) : (
					players.map((p) => (
						<View key={p.id} style={styles.rosterRow}>
							<Avatar name={p.name} image={p.image} size={22} />
							<ThemedText type="small" style={styles.rosterName} numberOfLines={1}>
								{p.name}
							</ThemedText>
						</View>
					))
				)}
			</View>
		</View>
	);
}

function Warning({ text }: { text: string }) {
	return (
		<View style={styles.warning}>
			<SymbolView
				name={{ ios: "exclamationmark.triangle", android: "warning", web: "warning" }}
				size={13}
				tintColor="#d97706"
			/>
			<ThemedText type="small" style={styles.warningText}>
				{text}
			</ThemedText>
		</View>
	);
}

function CheckRow({
	label,
	value,
	onToggle,
}: {
	label: string;
	value: boolean;
	onToggle: () => void;
}) {
	const theme = useTheme();
	return (
		<Pressable onPress={onToggle} style={styles.checkRow} hitSlop={6}>
			<View
				style={[
					styles.checkbox,
					{ borderColor: value ? theme.glowBlueBorder : theme.border },
					value && { backgroundColor: theme.glowBlueBg },
				]}
			>
				{value ? (
					<SymbolView
						name={{ ios: "checkmark", android: "check", web: "check" }}
						size={11}
						tintColor={theme.glowBlueText}
					/>
				) : null}
			</View>
			<ThemedText type="small">{label}</ThemedText>
		</Pressable>
	);
}

function PlayerSelectionModal({
	isOpen,
	onClose,
	players,
	onAssign,
	onShuffle,
	onEven,
	canReorder,
}: {
	isOpen: boolean;
	onClose: () => void;
	players: SelectablePlayer[];
	onAssign: (playerId: string, team: Team) => void;
	onShuffle: () => void;
	onEven: () => void;
	canReorder: boolean;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.flex}>
				<View
					style={[
						styles.content,
						{ paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.two },
					]}
				>
					<View style={styles.header}>
						<ThemedText type="subtitle">Select Players</ThemedText>
						<ModalCloseButton onPress={onClose} />
					</View>
					<View style={[styles.columns, { borderColor: theme.border }]}>
						<SelectionColumn team="home" label="Home" players={players} onAssign={onAssign} />
						<SelectionColumn
							team="away"
							label="Away"
							players={players}
							onAssign={onAssign}
							borderLeft
						/>
					</View>
					<View style={[styles.selectionFooter, { borderTopColor: theme.border }]}>
						<Button variant="outline" size="sm" onPress={onShuffle} disabled={!canReorder}>
							Shuffle
						</Button>
						<Button variant="outline" size="sm" onPress={onEven} disabled={!canReorder}>
							Even
						</Button>
						<Button variant="primary" size="sm" onPress={onClose}>
							Done
						</Button>
					</View>
				</View>
			</ThemedView>
		</Modal>
	);
}

function SelectionColumn({
	team,
	label,
	players,
	onAssign,
	borderLeft,
}: {
	team: Team;
	label: string;
	players: SelectablePlayer[];
	onAssign: (playerId: string, team: Team) => void;
	borderLeft?: boolean;
}) {
	const theme = useTheme();
	return (
		<View
			style={[
				styles.column,
				borderLeft && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border },
			]}
		>
			<View style={[styles.columnHeader, { borderBottomColor: theme.border }]}>
				<ThemedText type="small" themeColor="textSecondary">
					{label.toUpperCase()}
				</ThemedText>
			</View>
			<ScrollView style={styles.columnScroll}>
				{players.map((player) => {
					const onThisTeam = player.team === team;
					return (
						<Pressable
							key={player.id}
							onPress={() => onAssign(player.id, team)}
							style={[
								styles.playerItem,
								{ borderBottomColor: theme.border },
								onThisTeam && { backgroundColor: theme.glowBlueBg },
							]}
						>
							<Avatar name={player.name} image={player.image} size={22} />
							<View style={styles.playerInfo}>
								<ThemedText type="small" numberOfLines={1}>
									{player.name}
								</ThemedText>
								<ThemedText type="small" themeColor="textSecondary">
									{player.score}
								</ThemedText>
							</View>
							{onThisTeam ? (
								<SymbolView
									name={{
										ios: "checkmark.circle.fill",
										android: "check_circle",
										web: "check_circle",
									}}
									size={16}
									tintColor={theme.glowBlueText}
								/>
							) : null}
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: Spacing.four,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingBottom: Spacing.three,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	accent: {
		width: 4,
		height: 20,
		borderRadius: 2,
	},
	scroll: {
		flex: 1,
	},
	form: {
		gap: Spacing.three,
		paddingBottom: Spacing.four,
	},
	stepperRow: {
		flexDirection: "row",
		borderRadius: 10,
		paddingVertical: Spacing.two,
	},
	stepper: {
		flex: 1,
		alignItems: "center",
		gap: Spacing.one,
	},
	stepperControls: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	stepperValue: {
		fontSize: 32,
		lineHeight: 40,
		fontWeight: "700",
		minWidth: 44,
		textAlign: "center",
		fontVariant: ["tabular-nums"],
	},
	rosters: {
		flexDirection: "row",
		gap: Spacing.two,
	},
	roster: {
		flex: 1,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 8,
		overflow: "hidden",
	},
	rosterHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.one,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rosterBody: {
		minHeight: 96,
		padding: Spacing.two,
		gap: Spacing.two,
	},
	rosterEmpty: {
		textAlign: "center",
		marginTop: Spacing.three,
	},
	rosterRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	rosterName: {
		flex: 1,
	},
	messages: {
		gap: Spacing.one,
		minHeight: 20,
	},
	warning: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
	},
	warningText: {
		flex: 1,
		color: "#d97706",
	},
	actions: {
		gap: Spacing.three,
		paddingTop: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	checks: {
		flexDirection: "row",
		gap: Spacing.four,
	},
	checkRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderRadius: 4,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	actionRow: {
		flexDirection: "row",
		gap: Spacing.two,
	},
	submit: {
		flex: 1,
	},
	columns: {
		flex: 1,
		flexDirection: "row",
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 8,
		overflow: "hidden",
		marginTop: Spacing.two,
	},
	column: {
		flex: 1,
	},
	columnHeader: {
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.one,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	columnScroll: {
		flex: 1,
	},
	playerItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	playerInfo: {
		flex: 1,
	},
	selectionFooter: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: Spacing.two,
		paddingTop: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
});
