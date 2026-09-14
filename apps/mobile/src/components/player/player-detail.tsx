import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { MobileHeader } from "@/components/mobile-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

function formatAchievementName(type: string) {
	return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfoRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
	const theme = useTheme();
	return (
		<View style={[styles.row, { borderBottomColor: theme.border }]}>
			<ThemedText type="small" themeColor="textSecondary">
				{label}
			</ThemedText>
			<View style={styles.rowRight}>
				<ThemedText style={styles.rowValue}>{value}</ThemedText>
				{sub ? (
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						{sub}
					</ThemedText>
				) : null}
			</View>
		</View>
	);
}

function TeammateRow({
	label,
	tone,
	teammate,
}: {
	label: string;
	tone: "best" | "worst";
	teammate:
		| {
				name: string;
				avatar: string | null;
				matchesTogether: number;
				wins: number;
				losses: number;
				winRate: number;
				eloGained: number;
				eloLost: number;
		  }
		| null
		| undefined;
}) {
	const theme = useTheme();
	const color = tone === "best" ? "#22c55e" : "#ef4444";
	if (!teammate) {
		return (
			<View style={[styles.row, { borderBottomColor: theme.border }]}>
				<ThemedText type="small" themeColor="textSecondary">
					{label}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					No data
				</ThemedText>
			</View>
		);
	}
	return (
		<View style={[styles.teammateRow, { borderBottomColor: theme.border }]}>
			<Avatar name={teammate.name} image={getAvatarUri(teammate.avatar)} size={40} />
			<View style={styles.teammateInfo}>
				<ThemedText style={styles.teammateLabel} themeColor="textSecondary">
					{label}
				</ThemedText>
				<ThemedText style={styles.teammateName} numberOfLines={1}>
					{teammate.name}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					{teammate.matchesTogether} together · {teammate.winRate}% W · {teammate.wins}W-
					{teammate.losses}L
				</ThemedText>
			</View>
			<ThemedText style={[styles.teammateElo, { color }]}>
				{tone === "best" ? `+${teammate.eloGained}` : `-${teammate.eloLost}`}
			</ThemedText>
		</View>
	);
}

export function PlayerDetail({ playerId }: { playerId: string }) {
	const theme = useTheme();
	const trpc = useTRPC();

	const activeSeasonQuery = useQuery(trpc.season.findActive.queryOptions());
	const seasonSlug = activeSeasonQuery.data?.slug;

	const playerQuery = useQuery({
		...trpc.player.getById.queryOptions({ seasonSlug: seasonSlug ?? "", playerId }),
		enabled: !!seasonSlug,
	});
	const allTimeQuery = useQuery(trpc.player.getAllTimeStats.queryOptions({ playerId }));
	const bestSeasonQuery = useQuery(trpc.player.getBestSeason.queryOptions({ playerId }));
	const bestTeammateQuery = useQuery(trpc.player.getBestTeammate.queryOptions({ playerId }));
	const worstTeammateQuery = useQuery(trpc.player.getWorstTeammate.queryOptions({ playerId }));
	const historyQuery = useQuery(trpc.player.getSeasonHistory.queryOptions({ playerId }));
	const achievementsQuery = useQuery(trpc.achievement.getByPlayerId.queryOptions({ playerId }));
	const recentQuery = useQuery({
		...trpc.player.getRecentMatchesWithTeams.queryOptions({
			seasonSlug: seasonSlug ?? "",
			playerId,
		}),
		enabled: !!seasonSlug,
	});

	const player = playerQuery.data;
	const allTime = allTimeQuery.data;
	const bestSeason = bestSeasonQuery.data;
	const history = historyQuery.data ?? [];
	const achievements = achievementsQuery.data ?? [];
	const recent = recentQuery.data ?? [];

	const winRate =
		allTime && allTime.total > 0 ? Math.round((allTime.wins / allTime.total) * 100) : 0;

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<MobileHeader onBack={() => router.back()} title={player?.name ?? "Player"} />
				{playerQuery.isPending || !seasonSlug ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						Loading player…
					</ThemedText>
				) : playerQuery.isError ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary">
							Player not found
						</ThemedText>
					</View>
				) : (
					<ScrollView contentContainerStyle={styles.scroll}>
						<View style={styles.hero}>
							<Avatar
								name={player?.name ?? "?"}
								image={getAvatarUri(player?.image)}
								size={96}
								borderRadius={8}
							/>
							<ThemedText type="subtitle" numberOfLines={1} style={styles.heroName}>
								{player?.name}
							</ThemedText>
							<ThemedText type="small" themeColor="textSecondary">
								{winRate}% win rate · {allTime?.total ?? 0} matches
							</ThemedText>
							<Button
								variant="outline"
								size="sm"
								icon={{
									ios: "arrow.left.arrow.right",
									android: "compare_arrows",
									web: "compare_arrows",
								}}
								onPress={() =>
									router.push({ pathname: "/players/compare", params: { p1: playerId } })
								}
							>
								Compare
							</Button>
						</View>

						<Card>
							<CardContent style={styles.cardContent}>
								<ThemedText type="smallBold" style={styles.sectionTitle}>
									Overview
								</ThemedText>
								<InfoRow label="Current score" value={bestSeason ? String(bestSeason.elo) : "—"} />
								<InfoRow
									label="Win rate"
									value={`${winRate}%`}
									sub={`${allTime?.wins ?? 0}W · ${allTime?.losses ?? 0}L · ${allTime?.draws ?? 0}D`}
								/>
								<InfoRow
									label="Total matches"
									value={String(allTime?.total ?? 0)}
									sub={`Across ${allTime?.seasonCount ?? 0} season(s)`}
								/>
								<InfoRow
									label="Best season"
									value={bestSeason?.season ?? "—"}
									sub={
										bestSeason
											? `Peak ${bestSeason.elo} · ${bestSeason.matches} matches`
											: undefined
									}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardContent style={styles.cardContent}>
								<ThemedText type="smallBold" style={styles.sectionTitle}>
									Teammates
								</ThemedText>
								<TeammateRow label="Best teammate" tone="best" teammate={bestTeammateQuery.data} />
								<TeammateRow
									label="Worst teammate"
									tone="worst"
									teammate={worstTeammateQuery.data}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardContent style={styles.cardContent}>
								<ThemedText type="smallBold" style={styles.sectionTitle}>
									Achievements
								</ThemedText>
								{achievements.length === 0 ? (
									<ThemedText type="small" themeColor="textSecondary">
										No achievements yet
									</ThemedText>
								) : (
									<View style={styles.achievements}>
										{achievements.map((a) => (
											<View
												key={a.type}
												style={[styles.achievementChip, { borderColor: theme.border }]}
											>
												<ThemedText type="small">🏅</ThemedText>
												<ThemedText type="small">{formatAchievementName(a.type)}</ThemedText>
											</View>
										))}
									</View>
								)}
							</CardContent>
						</Card>

						{history.length > 1 ? (
							<Card>
								<CardContent style={styles.cardContent}>
									<ThemedText type="smallBold" style={styles.sectionTitle}>
										Season history
									</ThemedText>
									{history.map((h) => (
										<View key={h.slug} style={[styles.row, { borderBottomColor: theme.border }]}>
											<View style={styles.historyLeft}>
												<ThemedText style={styles.rowValue} numberOfLines={1}>
													{h.season}
												</ThemedText>
												<ThemedText type="small" themeColor="textSecondary">
													{h.wins}W · {h.losses}L · {h.winRate}% W
												</ThemedText>
											</View>
											<ThemedText style={styles.rowValue}>{h.score}</ThemedText>
										</View>
									))}
								</CardContent>
							</Card>
						) : null}

						<Card>
							<CardContent style={styles.cardContent}>
								<ThemedText type="smallBold" style={styles.sectionTitle}>
									Recent matches
								</ThemedText>
								{recent.length === 0 ? (
									<ThemedText type="small" themeColor="textSecondary">
										No recent matches
									</ThemedText>
								) : (
									recent.slice(0, 10).map((m) => {
										const delta = m.scoreAfter - m.scoreBefore;
										const resultColor =
											m.result === "W" ? "#22c55e" : m.result === "L" ? "#ef4444" : "#eab308";
										return (
											<View
												key={m.id}
												style={[styles.matchRow, { borderBottomColor: theme.border }]}
											>
												<View style={[styles.resultBadge, { borderColor: resultColor }]}>
													<ThemedText type="smallBold" style={{ color: resultColor }}>
														{m.result}
													</ThemedText>
												</View>
												<View style={styles.matchInfo}>
													<ThemedText type="small" numberOfLines={1}>
														{m.homeTeamName} vs {m.awayTeamName}
													</ThemedText>
													<ThemedText type="small" themeColor="textSecondary">
														{m.homeScore} – {m.awayScore}
													</ThemedText>
												</View>
												<ThemedText
													style={[styles.rowValue, { color: delta >= 0 ? "#22c55e" : "#ef4444" }]}
												>
													{delta >= 0 ? `+${delta}` : delta}
												</ThemedText>
											</View>
										);
									})
								)}
							</CardContent>
						</Card>
					</ScrollView>
				)}
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, flexDirection: "row", justifyContent: "center" },
	safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
	scroll: { gap: Spacing.four, paddingBottom: Spacing.six },
	hero: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.four },
	heroName: { textAlign: "center" },
	cardContent: { gap: 0 },
	sectionTitle: { marginBottom: Spacing.three },
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rowRight: { alignItems: "flex-end", gap: 2, flexShrink: 1 },
	rowValue: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
	historyLeft: { flex: 1, gap: 2 },
	teammateRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	teammateInfo: { flex: 1, gap: 2 },
	teammateLabel: { fontSize: 12, lineHeight: 16 },
	teammateName: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
	teammateElo: { fontSize: 16, fontWeight: "700" },
	achievements: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
	achievementChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.three,
		borderWidth: StyleSheet.hairlineWidth,
	},
	matchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	resultBadge: {
		width: 28,
		height: 28,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
	},
	matchInfo: { flex: 1, gap: 2 },
	empty: { textAlign: "center", marginTop: Spacing.five },
	emptyBox: { alignItems: "center", gap: Spacing.three, marginTop: Spacing.five },
});
