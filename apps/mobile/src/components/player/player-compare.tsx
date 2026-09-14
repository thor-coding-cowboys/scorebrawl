import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { MobileHeader } from "@/components/mobile-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card, CardContent } from "@/components/ui/card";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

type Pick = "p1" | "p2" | null;

interface PlayerLite {
	id: string;
	name: string;
	image?: string | null;
}

function PlayerSlot({
	player,
	label,
	onPress,
}: {
	player: PlayerLite | undefined;
	label: string;
	onPress: () => void;
}) {
	const theme = useTheme();
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.slot,
				{ borderColor: theme.border },
				pressed && { opacity: 0.7 },
			]}
		>
			{player ? (
				<>
					<Avatar name={player.name} image={getAvatarUri(player.image)} size={44} />
					<ThemedText type="smallBold" numberOfLines={1}>
						{player.name}
					</ThemedText>
				</>
			) : (
				<>
					<View style={[styles.slotEmpty, { backgroundColor: theme.backgroundElement }]}>
						<ThemedText type="small" themeColor="textSecondary">
							+
						</ThemedText>
					</View>
					<ThemedText type="small" themeColor="textSecondary">
						{label}
					</ThemedText>
				</>
			)}
		</Pressable>
	);
}

function CompareRow({
	label,
	left,
	right,
	higherWins = true,
}: {
	label: string;
	left: number | string;
	right: number | string;
	higherWins?: boolean;
}) {
	const theme = useTheme();
	const ln = typeof left === "number" ? left : Number.NaN;
	const rn = typeof right === "number" ? right : Number.NaN;
	const leftBetter = higherWins ? ln > rn : ln < rn;
	const rightBetter = higherWins ? rn > ln : rn < ln;
	return (
		<View style={[styles.compareRow, { borderBottomColor: theme.border }]}>
			<ThemedText
				style={[styles.compareValue, leftBetter && { color: "#22c55e", fontWeight: "700" }]}
			>
				{left}
			</ThemedText>
			<ThemedText type="small" themeColor="textSecondary" style={styles.compareLabel}>
				{label}
			</ThemedText>
			<ThemedText
				style={[
					styles.compareValue,
					styles.compareValueRight,
					rightBetter && { color: "#22c55e", fontWeight: "700" },
				]}
			>
				{right}
			</ThemedText>
		</View>
	);
}

export function PlayerCompare({ initialPlayer1Id }: { initialPlayer1Id?: string }) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const trpc = useTRPC();

	const [player1Id, setPlayer1Id] = useState(initialPlayer1Id ?? "");
	const [player2Id, setPlayer2Id] = useState("");
	const [pick, setPick] = useState<Pick>(null);
	const [search, setSearch] = useState("");

	const playersQuery = useQuery(trpc.player.getAll.queryOptions());
	const players = useMemo(
		() =>
			[...(playersQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)) as PlayerLite[],
		[playersQuery.data]
	);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players;
	}, [players, search]);

	const p1 = players.find((p) => p.id === player1Id);
	const p2 = players.find((p) => p.id === player2Id);

	const compareQuery = useQuery({
		...trpc.player.comparePlayers.queryOptions({ player1Id, player2Id }),
		enabled: !!player1Id && !!player2Id && player1Id !== player2Id,
	});
	const data = compareQuery.data;
	const p1Stats = data?.player1 ?? null;
	const p2Stats = data?.player2 ?? null;
	const h2h = data?.headToHead;

	const choose = (id: string) => {
		if (pick === "p1") setPlayer1Id(id);
		else if (pick === "p2") setPlayer2Id(id);
		setPick(null);
		setSearch("");
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<MobileHeader onBack={() => router.back()} title="Compare Players" />
				<ScrollView contentContainerStyle={styles.scroll}>
					<View style={styles.slots}>
						<PlayerSlot player={p1} label="Player A" onPress={() => setPick("p1")} />
						<PlayerSlot player={p2} label="Player B" onPress={() => setPick("p2")} />
					</View>

					{player1Id && player1Id === player2Id ? (
						<ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
							Pick two different players
						</ThemedText>
					) : null}

					{p1Stats && p2Stats ? (
						<>
							<Card>
								<CardContent style={styles.cardContent}>
									<ThemedText type="smallBold">All-time comparison</ThemedText>
									<CompareRow
										label="Matches"
										left={p1Stats.totalMatches}
										right={p2Stats.totalMatches}
									/>
									<CompareRow label="Wins" left={p1Stats.wins} right={p2Stats.wins} />
									<CompareRow
										label="Win %"
										left={`${p1Stats.winRate}%`}
										right={`${p2Stats.winRate}%`}
									/>
									<CompareRow
										label="Current ELO"
										left={p1Stats.currentElo}
										right={p2Stats.currentElo}
									/>
									<CompareRow
										label="Highest ELO"
										left={p1Stats.highestElo}
										right={p2Stats.highestElo}
									/>
									<CompareRow
										label="Longest win streak"
										left={p1Stats.longestWinStreak}
										right={p2Stats.longestWinStreak}
									/>
									<CompareRow
										label="Avg pts / match"
										left={p1Stats.avgPointsPerMatch}
										right={p2Stats.avgPointsPerMatch}
									/>
									<CompareRow
										label="Net ELO"
										left={p1Stats.netEloChange}
										right={p2Stats.netEloChange}
									/>
									<CompareRow
										label="Seasons"
										left={p1Stats.seasonsPlayed}
										right={p2Stats.seasonsPlayed}
									/>
								</CardContent>
							</Card>

							<Card>
								<CardContent style={styles.cardContent}>
									<ThemedText type="smallBold">Head to head</ThemedText>
									<View style={styles.h2hSummary}>
										<View style={styles.h2hSide}>
											<ThemedText type="subtitle">{h2h?.player1Wins ?? 0}</ThemedText>
											<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
												{p1?.name}
											</ThemedText>
										</View>
										<View style={styles.h2hMiddle}>
											<ThemedText type="small" themeColor="textSecondary">
												{h2h?.matchesPlayed ?? 0} played
											</ThemedText>
											<ThemedText type="small" themeColor="textSecondary">
												{h2h?.draws ?? 0} drawn
											</ThemedText>
										</View>
										<View style={styles.h2hSide}>
											<ThemedText type="subtitle">{h2h?.player2Wins ?? 0}</ThemedText>
											<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
												{p2?.name}
											</ThemedText>
										</View>
									</View>
									{(h2h?.recentMatches ?? []).map((m) => (
										<View
											key={m.matchId}
											style={[styles.h2hMatch, { borderTopColor: theme.border }]}
										>
											<ThemedText
												type="small"
												style={[
													styles.h2hResult,
													{
														color:
															m.result === "W"
																? "#22c55e"
																: m.result === "L"
																	? "#ef4444"
																	: "#eab308",
													},
												]}
											>
												{m.result}
											</ThemedText>
											<ThemedText type="small" style={styles.flex}>
												{m.homeScore} - {m.awayScore}
											</ThemedText>
											<ThemedText type="small" themeColor="textSecondary">
												{new Date(m.date).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
												})}
											</ThemedText>
										</View>
									))}
								</CardContent>
							</Card>
						</>
					) : (
						<ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
							Select two players to compare them.
						</ThemedText>
					)}
				</ScrollView>
			</SafeAreaView>

			<Modal visible={pick !== null} animationType="slide" onRequestClose={() => setPick(null)}>
				<ThemedView style={styles.flex}>
					<View style={[styles.pickerContent, { paddingTop: insets.top + Spacing.three }]}>
						<View style={styles.pickerHeader}>
							<ThemedText type="subtitle">{pick === "p1" ? "Player A" : "Player B"}</ThemedText>
							<ModalCloseButton onPress={() => setPick(null)} />
						</View>
						<TextInput
							value={search}
							onChangeText={setSearch}
							placeholder="Search players…"
							placeholderTextColor={theme.mutedForeground}
							style={[
								styles.search,
								{ borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
							]}
						/>
						<ScrollView style={styles.flex}>
							{filtered.map((p) => (
								<Pressable
									key={p.id}
									onPress={() => choose(p.id)}
									style={({ pressed }) => [
										styles.playerRow,
										{ borderBottomColor: theme.border },
										pressed && { opacity: 0.7 },
									]}
								>
									<Avatar name={p.name} image={getAvatarUri(p.image)} size={28} />
									<ThemedText style={styles.flex} numberOfLines={1}>
										{p.name}
									</ThemedText>
								</Pressable>
							))}
						</ScrollView>
					</View>
				</ThemedView>
			</Modal>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, flexDirection: "row", justifyContent: "center" },
	safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
	scroll: { gap: Spacing.three, paddingBottom: Spacing.five },
	slots: { flexDirection: "row", gap: Spacing.three },
	slot: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.two,
		borderWidth: StyleSheet.hairlineWidth,
		paddingVertical: Spacing.four,
		paddingHorizontal: Spacing.two,
		minHeight: 120,
	},
	slotEmpty: {
		width: 44,
		height: 44,
		borderRadius: 0,
		alignItems: "center",
		justifyContent: "center",
	},
	cardContent: { gap: Spacing.two },
	compareRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
		gap: Spacing.two,
	},
	compareValue: { width: 72, fontSize: 15, fontWeight: "600" },
	compareValueRight: { textAlign: "right" },
	compareLabel: { flex: 1, textAlign: "center" },
	h2hSummary: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: Spacing.three,
	},
	h2hSide: { flex: 1, alignItems: "center", gap: Spacing.one },
	h2hMiddle: { alignItems: "center", gap: 2 },
	h2hMatch: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	h2hResult: { width: 16, fontWeight: "700" },
	flex: { flex: 1 },
	hint: { textAlign: "center", paddingVertical: Spacing.four },
	pickerContent: { flex: 1, paddingHorizontal: Spacing.three, gap: Spacing.three },
	pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	search: {
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		fontSize: 15,
	},
	playerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
});
