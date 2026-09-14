import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { MobileHeader } from "@/components/mobile-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

function formatAchievementName(type: string) {
	return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	const theme = useTheme();
	return (
		<View style={[styles.section, { borderTopColor: theme.border }]}>
			<ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
				{title}
			</ThemedText>
			{children}
		</View>
	);
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<View style={styles.stat}>
			<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
				{label}
			</ThemedText>
			<ThemedText style={styles.statValue} numberOfLines={1}>
				{value}
			</ThemedText>
			{sub ? (
				<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
					{sub}
				</ThemedText>
			) : null}
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
		<View style={[styles.row, { borderBottomColor: theme.border }]}>
			<Avatar name={teammate.name} image={getAvatarUri(teammate.avatar)} size={40} />
			<View style={styles.rowInfo}>
				<ThemedText style={styles.rowValue} numberOfLines={1}>
					{teammate.name}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
					{teammate.matchesTogether} together · {teammate.winRate}% W · {teammate.wins}W-
					{teammate.losses}L
				</ThemedText>
			</View>
			<ThemedText style={[styles.eloValue, { color }]}>
				{tone === "best" ? `+${teammate.eloGained}` : `-${teammate.eloLost}`}
			</ThemedText>
		</View>
	);
}

export function PlayerDetail({ playerId, view = "overview" }: { playerId: string; view?: string }) {
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
						{view === "overview" ? (
							<>
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
								<Section title="Overview">
									<View style={styles.grid}>
										<Stat label="Current score" value={bestSeason ? String(bestSeason.elo) : "—"} />
										<Stat
											label="Win rate"
											value={`${winRate}%`}
											sub={`${allTime?.wins ?? 0}W · ${allTime?.losses ?? 0}L`}
										/>
										<Stat
											label="Total matches"
											value={String(allTime?.total ?? 0)}
											sub={`${allTime?.seasonCount ?? 0} season(s)`}
										/>
										<Stat
											label="Best season"
											value={bestSeason?.season ?? "—"}
											sub={bestSeason ? `Peak ${bestSeason.elo}` : undefined}
										/>
									</View>
								</Section>
								<Section title="Teammates">
									<TeammateRow
										label="Best teammate"
										tone="best"
										teammate={bestTeammateQuery.data}
									/>
									<TeammateRow
										label="Worst teammate"
										tone="worst"
										teammate={worstTeammateQuery.data}
									/>
								</Section>
							</>
						) : null}

						{view === "achievements" ? (
							<Section title="Achievements">
								{achievements.length === 0 ? (
									<ThemedText type="small" themeColor="textSecondary">
										No achievements yet
									</ThemedText>
								) : (
									<View style={styles.achievements}>
										{achievements.map((a) => (
											<View key={a.type} style={styles.achievementItem}>
												<View
													style={[
														styles.achievementBadge,
														{
															backgroundColor: `${theme.primary}1a`,
															borderColor: `${theme.primary}33`,
														},
													]}
												>
													<SymbolView
														name={{ ios: "medal", android: "military_tech", web: "military_tech" }}
														size={28}
														tintColor={theme.primary}
													/>
												</View>
												<ThemedText type="small" style={styles.achievementName}>
													{formatAchievementName(a.type)}
												</ThemedText>
											</View>
										))}
									</View>
								)}
							</Section>
						) : null}

						{view === "seasons" ? (
							<Section title="Season history">
								{history.length === 0 ? (
									<ThemedText type="small" themeColor="textSecondary">
										No season history
									</ThemedText>
								) : (
									history.map((h) => (
										<View key={h.slug} style={[styles.row, { borderBottomColor: theme.border }]}>
											<View style={styles.rowInfo}>
												<ThemedText style={styles.rowValue} numberOfLines={1}>
													{h.season}
												</ThemedText>
												<ThemedText type="small" themeColor="textSecondary">
													{h.wins}W · {h.losses}L · {h.winRate}% W
												</ThemedText>
											</View>
											<ThemedText style={styles.subValue}>{h.score}</ThemedText>
										</View>
									))
								)}
							</Section>
						) : null}

						{view === "matches" ? (
							<Section title="Recent matches">
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
											<View key={m.id} style={[styles.row, { borderBottomColor: theme.border }]}>
												<View style={[styles.resultBadge, { borderColor: resultColor }]}>
													<ThemedText type="smallBold" style={{ color: resultColor }}>
														{m.result}
													</ThemedText>
												</View>
												<View style={styles.rowInfo}>
													<ThemedText type="small" numberOfLines={1}>
														{m.homeTeamName} vs {m.awayTeamName}
													</ThemedText>
													<ThemedText type="small" themeColor="textSecondary">
														{m.homeScore} – {m.awayScore}
													</ThemedText>
												</View>
												<ThemedText
													style={[styles.subValue, { color: delta >= 0 ? "#22c55e" : "#ef4444" }]}
												>
													{delta >= 0 ? `+${delta}` : delta}
												</ThemedText>
											</View>
										);
									})
								)}
							</Section>
						) : null}
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
	section: {
		gap: Spacing.two,
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingTop: Spacing.four,
	},
	sectionTitle: {
		fontSize: 13,
		lineHeight: 18,
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: Spacing.one,
	},
	grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three },
	stat: {
		width: "47%",
		flexGrow: 1,
		gap: 2,
		paddingVertical: Spacing.two,
	},
	statValue: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rowInfo: { flex: 1, gap: 2 },
	rowValue: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
	subValue: { fontSize: 16, fontWeight: "700" },
	eloValue: { fontSize: 16, fontWeight: "700" },
	achievements: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three },
	achievementItem: { width: "30%", alignItems: "center", gap: Spacing.two },
	achievementBadge: {
		width: 64,
		height: 64,
		borderRadius: 32,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	achievementName: { textAlign: "center" },
	resultBadge: {
		width: 28,
		height: 28,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
	},
	empty: { textAlign: "center", marginTop: Spacing.five },
	emptyBox: { alignItems: "center", gap: Spacing.three, marginTop: Spacing.five },
});
