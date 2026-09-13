import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Fonts, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

type RotationMode = "winner-stays" | "manual";
type RandomizerType = "off" | "fisher-yates" | "diversity";

const ROTATION_OPTIONS: { value: RotationMode; label: string }[] = [
	{ value: "winner-stays", label: "Winner Stays" },
	{ value: "manual", label: "Manual" },
];

const RANDOMIZER_OPTIONS: { value: RandomizerType; label: string }[] = [
	{ value: "off", label: "Off" },
	{ value: "fisher-yates", label: "Fisher-Yates" },
	{ value: "diversity", label: "Diversity" },
];

const RANDOMIZER_DESCRIPTION: Record<RandomizerType, string> = {
	off: "No auto-shuffle - teams stay as manually arranged",
	"fisher-yates": "Pure random shuffle - every pairing equally likely",
	diversity: "Prefer pairing players who haven't played together recently",
};

export function StartSessionModal({
	isOpen,
	onClose,
	seasonSlug,
}: {
	isOpen: boolean;
	onClose: () => void;
	seasonSlug: string;
}) {
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	const theme = useTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [rotationMode, setRotationMode] = useState<RotationMode>("winner-stays");
	const [teamSize, setTeamSize] = useState(2);
	const [maxConsecutiveEnabled, setMaxConsecutiveEnabled] = useState(true);
	const [maxConsecutiveGames, setMaxConsecutiveGames] = useState(3);
	const [winnersTakePriority, setWinnersTakePriority] = useState(false);
	const [randomizerType, setRandomizerType] = useState<RandomizerType>("fisher-yates");
	const [autoCoinToss, setAutoCoinToss] = useState(true);
	const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
	const [alwaysSplitPairs, setAlwaysSplitPairs] = useState<[string, string][]>([]);
	const [splitPickA, setSplitPickA] = useState<string | null>(null);
	const [splitPickB, setSplitPickB] = useState<string | null>(null);
	const [pickTarget, setPickTarget] = useState<"a" | "b" | null>(null);
	const [playerSearch, setPlayerSearch] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [step, setStep] = useState<0 | 1>(0);
	const [error, setError] = useState("");

	const standingQuery = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));
	const seasonPlayers = useMemo(() => standingQuery.data ?? [], [standingQuery.data]);

	useEffect(() => {
		if (isOpen) {
			setRotationMode("winner-stays");
			setTeamSize(2);
			setMaxConsecutiveEnabled(true);
			setMaxConsecutiveGames(3);
			setWinnersTakePriority(false);
			setRandomizerType("fisher-yates");
			setAutoCoinToss(true);
			setSelectedPlayerIds([]);
			setAlwaysSplitPairs([]);
			setSplitPickA(null);
			setSplitPickB(null);
			setPickTarget(null);
			setPlayerSearch("");
			setStep(0);
			setError("");
		}
	}, [isOpen]);

	const sortedPlayers = useMemo(
		() => [...seasonPlayers].sort((a, b) => b.matchCount - a.matchCount),
		[seasonPlayers]
	);
	const filteredPlayers = useMemo(() => {
		const q = playerSearch.trim().toLowerCase();
		return q ? sortedPlayers.filter((p) => p.name.toLowerCase().includes(q)) : sortedPlayers;
	}, [sortedPlayers, playerSearch]);

	const togglePlayer = (id: string) => {
		setSelectedPlayerIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
		);
		setAlwaysSplitPairs((prev) => prev.filter((p) => !p.includes(id)));
	};

	const addSplitPair = (a: string, b: string) => {
		if (!a || !b || a === b) return;
		setAlwaysSplitPairs((prev) =>
			prev.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))
				? prev
				: [...prev, [a, b]]
		);
	};

	const pickSplitPlayer = (id: string) => {
		const nextA = pickTarget === "a" ? id : splitPickA;
		const nextB = pickTarget === "b" ? id : splitPickB;
		if (nextA && nextB && nextA !== nextB) {
			addSplitPair(nextA, nextB);
			setSplitPickA(null);
			setSplitPickB(null);
		} else {
			setSplitPickA(nextA);
			setSplitPickB(nextB);
		}
		setPickTarget(null);
	};

	const playerName = (seasonPlayerId: string) =>
		seasonPlayers.find((p) => p.id === seasonPlayerId)?.name ?? "Unknown";

	const minPlayers = teamSize * 2;
	const canSubmit = selectedPlayerIds.length >= minPlayers && !isSubmitting;

	const submit = async () => {
		if (selectedPlayerIds.length < minPlayers) {
			setError(`Select at least ${minPlayers} players`);
			return;
		}
		setIsSubmitting(true);
		setError("");
		try {
			const session = await trpcClient.session.create.mutate({
				seasonSlug,
				rotationMode,
				teamSize,
				maxConsecutiveEnabled,
				maxConsecutiveGames: maxConsecutiveEnabled ? maxConsecutiveGames : null,
				winnersTakePriority,
				seasonPlayerIds: selectedPlayerIds,
				alwaysSplitConstraints: alwaysSplitPairs,
				autoRandomize: randomizerType !== "off",
				...(randomizerType !== "off" ? { randomizerType } : {}),
				autoCoinToss,
			});
			queryClient.invalidateQueries({ queryKey: trpc.session.getActive.queryKey({ seasonSlug }) });
			queryClient.invalidateQueries({
				queryKey: trpc.session.listEnded.queryKey({ seasonSlug, limit: 10 }),
			});
			onClose();
			router.replace({
				pathname: "/seasons/[seasonSlug]/session/[sessionId]",
				params: { seasonSlug, sessionId: session.id, view: "next" },
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start session");
		} finally {
			setIsSubmitting(false);
		}
	};

	const splitPickerOptions = selectedPlayerIds
		.filter((id) => id !== (pickTarget === "a" ? splitPickB : splitPickA))
		.map((id) => ({ id, name: playerName(id) }));

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
						<View style={styles.titleRow}>
							<View style={[styles.accent, { backgroundColor: "#10b981" }]} />
							<View>
								<ThemedText type="subtitle">Start Session</ThemedText>
								<ThemedText type="small" themeColor="textSecondary">
									Configure rotation rules and select players.
								</ThemedText>
							</View>
						</View>
						<ModalCloseButton onPress={onClose} />
					</View>

					<ScrollView
						style={styles.scroll}
						contentContainerStyle={styles.form}
						keyboardShouldPersistTaps="handled"
					>
						{step === 0 ? (
							<>
								<View style={styles.section}>
									<ThemedText type="smallBold">Rotation Mode</ThemedText>
									<Segmented
										options={ROTATION_OPTIONS}
										value={rotationMode}
										onChange={setRotationMode}
									/>
								</View>

								<View style={styles.section}>
									<ThemedText type="smallBold">Team Size</ThemedText>
									<NumberStepper value={teamSize} min={1} max={6} onChange={setTeamSize} />
								</View>

								{rotationMode === "winner-stays" ? (
									<>
										<ToggleRow
											label="Winners Take Priority"
											description={
												winnersTakePriority
													? "ON: winners go to top of queue"
													: "OFF: winners placed above losers"
											}
											value={winnersTakePriority}
											onToggle={() => setWinnersTakePriority((v) => !v)}
										/>
										<ToggleRow
											label="Max Consecutive Games"
											description="Limit how many games in a row"
											value={maxConsecutiveEnabled}
											onToggle={() => setMaxConsecutiveEnabled((v) => !v)}
										/>
										{maxConsecutiveEnabled ? (
											<NumberStepper
												value={maxConsecutiveGames}
												min={1}
												max={20}
												onChange={setMaxConsecutiveGames}
											/>
										) : null}

										<View style={styles.section}>
											<ThemedText type="smallBold">Auto Randomize</ThemedText>
											<ThemedText type="small" themeColor="textSecondary">
												{RANDOMIZER_DESCRIPTION[randomizerType]}
											</ThemedText>
											<Segmented
												options={RANDOMIZER_OPTIONS}
												value={randomizerType}
												onChange={setRandomizerType}
											/>
										</View>

										<ToggleRow
											label="Auto Coin Toss"
											description="Auto-resolve coin tosses"
											value={autoCoinToss}
											onToggle={() => setAutoCoinToss((v) => !v)}
										/>
									</>
								) : null}
							</>
						) : (
							<>
								<View style={[styles.playersBox, { borderColor: theme.border }]}>
									<View style={styles.playersHeader}>
										<ThemedText type="smallBold">Players</ThemedText>
										<ThemedText type="small" themeColor="textSecondary">
											{selectedPlayerIds.length} selected
										</ThemedText>
									</View>
									<View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
										<SymbolView
											name={{ ios: "magnifyingglass", android: "search", web: "search" }}
											size={15}
											tintColor={theme.textSecondary}
										/>
										<TextInput
											value={playerSearch}
											onChangeText={setPlayerSearch}
											placeholder="Search players..."
											placeholderTextColor={theme.mutedForeground}
											style={[styles.searchInput, { color: theme.text }]}
										/>
									</View>
									<ScrollView
										style={[styles.playerList, { maxHeight: Math.round(windowHeight * 0.4) }]}
										nestedScrollEnabled
									>
										{filteredPlayers.length === 0 ? (
											<ThemedText
												type="small"
												themeColor="textSecondary"
												style={styles.emptyPlayers}
											>
												{seasonPlayers.length === 0 ? "No players in this season" : "No matches"}
											</ThemedText>
										) : (
											filteredPlayers.map((p) => {
												const selected = selectedPlayerIds.includes(p.id);
												return (
													<Pressable
														key={p.id}
														onPress={() => togglePlayer(p.id)}
														style={[
															styles.playerRow,
															{ borderBottomColor: theme.border },
															selected && { backgroundColor: `${theme.primary}1a` },
														]}
													>
														<Avatar name={p.name} image={getAvatarUri(p.image)} size={22} />
														<View style={styles.playerInfo}>
															<ThemedText type="small" numberOfLines={1}>
																{p.name}
															</ThemedText>
															<ThemedText type="small" themeColor="textSecondary">
																{p.score} · {p.matchCount} matches
															</ThemedText>
														</View>
														{selected ? (
															<SymbolView
																name={{ ios: "checkmark", android: "check", web: "check" }}
																size={14}
																tintColor={theme.primary}
															/>
														) : null}
													</Pressable>
												);
											})
										)}
									</ScrollView>
								</View>

								{selectedPlayerIds.length >= 2 && rotationMode === "winner-stays" ? (
									<View style={styles.section}>
										<ThemedText type="smallBold">Always Split</ThemedText>
										<ThemedText type="small" themeColor="textSecondary">
											Pairs that must always be on opposite teams
										</ThemedText>
										<View style={styles.splitRow}>
											<SplitButton
												label={splitPickA ? playerName(splitPickA) : "Player A"}
												onPress={() => setPickTarget("a")}
												selected={!!splitPickA}
											/>
											<SplitButton
												label={splitPickB ? playerName(splitPickB) : "Player B"}
												onPress={() => setPickTarget("b")}
												selected={!!splitPickB}
											/>
										</View>
										{alwaysSplitPairs.length > 0 ? (
											<ScrollView
												style={[styles.pairList, { borderColor: theme.border }]}
												nestedScrollEnabled
											>
												{alwaysSplitPairs.map(([a, b]) => (
													<View
														key={`${a}-${b}`}
														style={[styles.pairRow, { borderBottomColor: theme.border }]}
													>
														<ThemedText type="small" style={styles.pairName} numberOfLines={1}>
															{playerName(a)}
														</ThemedText>
														<ThemedText type="small" themeColor="textSecondary">
															vs
														</ThemedText>
														<ThemedText type="small" style={styles.pairName} numberOfLines={1}>
															{playerName(b)}
														</ThemedText>
														<Pressable
															onPress={() =>
																setAlwaysSplitPairs((prev) =>
																	prev.filter((p) => !(p[0] === a && p[1] === b))
																)
															}
															hitSlop={8}
														>
															<SymbolView
																name={{ ios: "xmark", android: "close", web: "close" }}
																size={13}
																tintColor={theme.textSecondary}
															/>
														</Pressable>
													</View>
												))}
											</ScrollView>
										) : null}
									</View>
								) : null}
							</>
						)}

						{error ? (
							<ThemedText type="small" style={{ color: theme.destructive }}>
								{error}
							</ThemedText>
						) : null}
					</ScrollView>

					<View style={[styles.actions, { borderTopColor: theme.border }]}>
						{step === 0 ? (
							<>
								<Button variant="outline" onPress={onClose} disabled={isSubmitting}>
									Cancel
								</Button>
								<Button style={styles.submit} onPress={() => setStep(1)}>
									Next
								</Button>
							</>
						) : (
							<>
								<Button variant="outline" onPress={() => setStep(0)} disabled={isSubmitting}>
									Back
								</Button>
								<Button
									style={styles.submit}
									onPress={submit}
									loading={isSubmitting}
									disabled={!canSubmit}
								>
									Start Session
								</Button>
							</>
						)}
					</View>
				</View>

				<Modal visible={pickTarget !== null} animationType="slide" transparent>
					<View style={styles.pickOverlay}>
						<ThemedView
							style={[styles.pickSheet, { paddingBottom: insets.bottom + Spacing.three }]}
						>
							<ThemedText type="subtitle" style={styles.pickTitle}>
								Select a player
							</ThemedText>
							<ScrollView style={styles.pickList}>
								{splitPickerOptions.map((p) => (
									<Pressable
										key={p.id}
										onPress={() => pickSplitPlayer(p.id)}
										style={[styles.playerRow, { borderBottomColor: theme.border }]}
									>
										<ThemedText type="small">{p.name}</ThemedText>
									</Pressable>
								))}
							</ScrollView>
							<Button variant="outline" onPress={() => setPickTarget(null)}>
								Cancel
							</Button>
						</ThemedView>
					</View>
				</Modal>
			</ThemedView>
		</Modal>
	);
}

function Segmented<T extends string>({
	options,
	value,
	onChange,
}: {
	options: { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	const theme = useTheme();
	return (
		<View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
			{options.map((opt) => {
				const active = opt.value === value;
				return (
					<Pressable
						key={opt.value}
						onPress={() => onChange(opt.value)}
						style={[styles.segment, active && { backgroundColor: theme.background }]}
					>
						<ThemedText
							type="small"
							style={active ? { color: theme.text } : { color: theme.textSecondary }}
							numberOfLines={1}
						>
							{opt.label}
						</ThemedText>
					</Pressable>
				);
			})}
		</View>
	);
}

function ToggleRow({
	label,
	description,
	value,
	onToggle,
}: {
	label: string;
	description: string;
	value: boolean;
	onToggle: () => void;
}) {
	const theme = useTheme();
	return (
		<Pressable onPress={onToggle} style={styles.toggleRow} hitSlop={4}>
			<View style={styles.toggleText}>
				<ThemedText type="smallBold">{label}</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					{description}
				</ThemedText>
			</View>
			<View
				style={[
					styles.switch,
					{
						backgroundColor: value ? theme.primary : theme.backgroundSelected,
						alignItems: value ? "flex-end" : "flex-start",
					},
				]}
			>
				<View style={[styles.knob, { backgroundColor: theme.background }]} />
			</View>
		</Pressable>
	);
}

function NumberStepper({
	value,
	min,
	max,
	onChange,
}: {
	value: number;
	min: number;
	max: number;
	onChange: (value: number) => void;
}) {
	return (
		<View style={styles.stepper}>
			<Button variant="outline" size="sm" onPress={() => onChange(Math.max(min, value - 1))}>
				−
			</Button>
			<ThemedText style={styles.stepperValue}>{value}</ThemedText>
			<Button variant="outline" size="sm" onPress={() => onChange(Math.min(max, value + 1))}>
				+
			</Button>
		</View>
	);
}

function SplitButton({
	label,
	onPress,
	selected,
}: {
	label: string;
	onPress: () => void;
	selected: boolean;
}) {
	const theme = useTheme();
	return (
		<Pressable
			onPress={onPress}
			style={[
				styles.splitButton,
				{ borderColor: selected ? theme.primary : theme.border },
				selected && { backgroundColor: `${theme.primary}1a` },
			]}
		>
			<ThemedText type="small" numberOfLines={1}>
				{label}
			</ThemedText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { flex: 1, paddingHorizontal: Spacing.four },
	header: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		paddingBottom: Spacing.three,
	},
	titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, flex: 1 },
	accent: { width: 4, height: 28, borderRadius: 2 },
	scroll: { flex: 1 },
	form: { gap: Spacing.four, paddingBottom: Spacing.four },
	section: { gap: Spacing.two },
	segmented: {
		flexDirection: "row",
		borderRadius: 10,
		padding: 3,
		gap: 3,
	},
	segment: {
		flex: 1,
		alignItems: "center",
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 8,
	},
	stepper: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
	stepperValue: {
		fontSize: 22,
		lineHeight: 28,
		fontWeight: "700",
		minWidth: 40,
		textAlign: "center",
		fontVariant: ["tabular-nums"],
	},
	toggleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
	toggleText: { flex: 1, gap: 2 },
	switch: {
		width: 46,
		height: 28,
		borderRadius: 14,
		padding: 3,
		justifyContent: "center",
	},
	knob: { width: 22, height: 22, borderRadius: 11 },
	playersBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: "hidden" },
	playersHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
	},
	searchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, padding: 0 },
	playerList: { minHeight: 160 },
	playerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	playerInfo: { flex: 1, gap: 1 },
	emptyPlayers: { textAlign: "center", paddingVertical: Spacing.four },
	splitRow: { flexDirection: "row", gap: Spacing.two },
	splitButton: {
		flex: 1,
		minWidth: 0,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.three,
		borderWidth: 1,
		borderRadius: 8,
	},
	pairList: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 8,
		overflow: "hidden",
		maxHeight: 140,
	},
	pairRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	pairName: { flex: 1 },
	actions: {
		flexDirection: "row",
		gap: Spacing.two,
		paddingTop: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	submit: { flex: 1 },
	pickOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
	pickSheet: {
		maxHeight: "70%",
		paddingHorizontal: Spacing.four,
		paddingTop: Spacing.four,
		gap: Spacing.three,
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
	},
	pickTitle: { fontSize: 20, lineHeight: 28 },
	pickList: { maxHeight: 360 },
});
