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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<Card style={styles.statCard}>
			<CardContent style={styles.cardContent}>
				<ThemedText type="small" themeColor="textSecondary">
					{label}
				</ThemedText>
				<ThemedText type="smallBold" style={styles.statValue}>
					{value}
				</ThemedText>
				{sub ? (
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						{sub}
					</ThemedText>
				) : null}
			</CardContent>
		</Card>
	);
}

function TeammateCard({
	title,
	tone,
	teammate,
}: {
	title: string;
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
	const color = tone === "best" ? "#22c55e" : "#ef4444";
	return (
		<Card style={styles.statCard}>
			<CardContent style={styles.cardContent}>
				<ThemedText type="small" themeColor="textSecondary">
					{title}
				</ThemedText>
				{teammate ? (
					<>
						<View style={styles.teammateRow}>
							<Avatar name={teammate.name} image={getAvatarUri(teammate.avatar)} size={24} />
							<ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
								{teammate.name}
							</ThemedText>
						</View>
						<ThemedText type="small" themeColor="textSecondary">
							{teammate.matchesTogether} together · {teammate.winRate}% W
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary">
							{teammate.wins}W-{teammate.losses}L
						</ThemedText>
						<ThemedText type="small" style={{ color }}>
							ELO {tone === "best" ? `+${teammate.eloGained}` : `-${teammate.eloLost}`}
						</ThemedText>
					</>
				) : (
					<ThemedText type="small" themeColor="textSecondary">
						No teammate data available
					</ThemedText>
				)}
			</CardContent>
		</Card>
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
								size={80}
								borderRadius={8}
							/>
							<ThemedText type="subtitle" numberOfLines={1}>
								{player?.name}
							</ThemedText>
							<ThemedText type="small" themeColor="textSecondary">
								{winRate}% Win Rate
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

						<View style={styles.grid}>
							<StatCard
								label="Current Score"
								value={bestSeason ? String(bestSeason.elo) : "N/A"}
								sub="Current season"
							/>
							<StatCard
								label="Win Rate"
								value={`${winRate}%`}
								sub={`${allTime?.wins ?? 0}W / ${allTime?.losses ?? 0}L`}
							/>
							<StatCard
								label="Total Matches"
								value={String(allTime?.total ?? 0)}
								sub={`Across ${allTime?.seasonCount ?? 0} season(s)`}
							/>
							<StatCard
								label="Best Season"
								value={bestSeason?.season ?? "N/A"}
								sub={
									bestSeason ? `Peak: ${bestSeason.elo} (${bestSeason.matches} matches)` : undefined
								}
							/>
						</View>

						<View style={styles.grid}>
							<TeammateCard title="Best Teammate" tone="best" teammate={bestTeammateQuery.data} />
							<TeammateCard
								title="Worst Teammate"
								tone="worst"
								teammate={worstTeammateQuery.data}
							/>
						</View>

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
											<View key={a.type} style={styles.achievement}>
												<ThemedText type="small">🏅</ThemedText>
												<ThemedText type="small" numberOfLines={1}>
													{formatAchievementName(a.type)}
												</ThemedText>
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
										Season History
									</ThemedText>
									{history.map((h) => (
										<View key={h.slug} style={[styles.row, { borderBottomColor: theme.border }]}>
											<ThemedText style={styles.flex} numberOfLines={1}>
												{h.season}
											</ThemedText>
											<ThemedText type="small" themeColor="textSecondary">
												{h.wins}W-{h.losses}L
											</ThemedText>
											<ThemedText type="smallBold">{h.score}</ThemedText>
										</View>
									))}
								</CardContent>
							</Card>
						) : null}

						<Card>
							<CardContent style={styles.cardContent}>
								<ThemedText type="smallBold" style={styles.sectionTitle}>
									Recent Matches
								</ThemedText>
								{recent.length === 0 ? (
									<ThemedText type="small" themeColor="textSecondary">
										No recent matches
									</ThemedText>
								) : (
									recent.slice(0, 10).map((m) => {
										const delta = m.scoreAfter - m.scoreBefore;
										return (
											<View key={m.id} style={[styles.row, { borderBottomColor: theme.border }]}>
												<ThemedText type="small" style={styles.result}>
													{m.result}
												</ThemedText>
												<View style={styles.flex}>
													<ThemedText type="small" numberOfLines={1}>
														{m.homeTeamName} vs {m.awayTeamName}
													</ThemedText>
													<ThemedText type="small" themeColor="textSecondary">
														{m.homeScore} - {m.awayScore}
													</ThemedText>
												</View>
												<ThemedText
													type="small"
													style={{ color: delta >= 0 ? "#22c55e" : "#ef4444" }}
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
	scroll: { gap: Spacing.four, paddingBottom: Spacing.five },
	hero: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.three },
	grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three },
	statCard: { width: "47%", flexGrow: 1 },
	cardContent: { gap: Spacing.two },
	statValue: { fontSize: 22, lineHeight: 28 },
	teammateRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
		marginTop: Spacing.one,
	},
	flex: { flex: 1 },
	sectionTitle: { marginBottom: Spacing.two },
	achievements: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
	achievement: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	result: { width: 16, fontWeight: "700" },
	empty: { textAlign: "center", marginTop: Spacing.five },
	emptyBox: { alignItems: "center", gap: Spacing.three, marginTop: Spacing.five },
});
