import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { MobileHeader } from "@/components/mobile-header";
import { formatDuration, rotationLabel } from "@/components/session/utils";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

function formatDate(value: Date | string) {
	return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

export function SessionSummaryView({ sessionId }: { sessionId: string }) {
	const theme = useTheme();
	const trpc = useTRPC();
	const query = useQuery(trpc.session.getSummary.queryOptions({ sessionId }));
	const { refreshing, onRefresh } = usePullToRefresh(() => query.refetch());
	const summary = query.data;

	const players = [...(summary?.playerStats ?? [])].sort((a, b) => b.wins - a.wins);
	const mvp = players[0];
	const combos = summary?.teamCombos ?? [];
	const bestCombo = combos[0];
	const worstCombo = combos.length > 1 ? combos[combos.length - 1] : undefined;
	const comboName = (c: (typeof combos)[number]) =>
		c.players.map((p) => p.displayName.split(" ")[0]).join(" & ");

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<MobileHeader onBack={() => router.back()} title="Session Summary" showLeagueIcon={false} />
				{query.isPending ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						Loading summary…
					</ThemedText>
				) : query.isError || !summary ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary">
							Couldn't load summary
						</ThemedText>
						<Button variant="outline" onPress={() => query.refetch()}>
							Retry
						</Button>
					</View>
				) : (
					<ScrollView
						contentContainerStyle={styles.scroll}
						refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
					>
						<Section title="Session">
							<View style={styles.grid}>
								<Stat
									label="Date"
									value={formatDate(summary.createdAt)}
									sub={rotationLabel(summary.rotationMode)}
								/>
								<Stat label="Duration" value={formatDuration(summary.createdAt, summary.endedAt)} />
								<Stat label="Matches" value={String(summary.totalMatches)} />
								<Stat label="Players" value={String(summary.playerStats.length)} />
								<Stat
									label="MVP"
									value={mvp ? mvp.displayName : "—"}
									sub={mvp ? `${mvp.wins}W · ${mvp.gamesPlayedThisSession}G` : "No matches"}
								/>
								<Stat
									label="Best team"
									value={bestCombo ? comboName(bestCombo) : "—"}
									sub={bestCombo ? `${bestCombo.winRate}% win rate` : "No team data"}
								/>
								{worstCombo ? (
									<Stat
										label="Worst team"
										value={comboName(worstCombo)}
										sub={`${worstCombo.winRate}% win rate`}
									/>
								) : null}
							</View>
						</Section>

						<Section title="Player standings">
							{players.map((p, i) => {
								const delta =
									p.scoreBeforeSession != null && p.scoreAfterSession != null
										? p.scoreAfterSession - p.scoreBeforeSession
										: null;
								return (
									<View
										key={p.seasonPlayerId}
										style={[styles.row, { borderBottomColor: theme.border }]}
									>
										<ThemedText type="small" themeColor="textSecondary" style={styles.rank}>
											{i + 1}
										</ThemedText>
										<Avatar name={p.displayName} image={getAvatarUri(p.playerImage)} size={32} />
										<View style={styles.rowInfo}>
											<ThemedText style={styles.rowValue} numberOfLines={1}>
												{p.displayName}
											</ThemedText>
											<ThemedText type="small" themeColor="textSecondary">
												{p.gamesPlayedThisSession}G · {p.wins}W · {p.losses}L
											</ThemedText>
										</View>
										{delta != null ? (
											<ThemedText
												style={[styles.subValue, { color: delta >= 0 ? "#22c55e" : "#ef4444" }]}
											>
												{delta >= 0 ? `+${delta}` : delta}
											</ThemedText>
										) : null}
									</View>
								);
							})}
						</Section>

						{summary.matchFeed.length > 0 ? (
							<Section title="Match-by-match">
								{summary.matchFeed.map((m) => {
									const homeWon = m.homeScore > m.awayScore;
									const awayWon = m.awayScore > m.homeScore;
									return (
										<View
											key={m.matchNumber}
											style={[styles.row, { borderBottomColor: theme.border }]}
										>
											<ThemedText type="small" themeColor="textSecondary" style={styles.matchNum}>
												#{m.matchNumber}
											</ThemedText>
											<View style={styles.matchLines}>
												<View style={styles.matchLine}>
													<ThemedText
														type="small"
														themeColor={homeWon ? "text" : "textSecondary"}
														style={[styles.matchSide, homeWon && styles.matchWinner]}
														numberOfLines={1}
													>
														{m.homePlayers.map((p) => p.displayName.split(" ")[0]).join(" & ")}
													</ThemedText>
													<ThemedText type="smallBold">{m.homeScore}</ThemedText>
												</View>
												<View style={styles.matchLine}>
													<ThemedText
														type="small"
														themeColor={awayWon ? "text" : "textSecondary"}
														style={[styles.matchSide, awayWon && styles.matchWinner]}
														numberOfLines={1}
													>
														{m.awayPlayers.map((p) => p.displayName.split(" ")[0]).join(" & ")}
													</ThemedText>
													<ThemedText type="smallBold">{m.awayScore}</ThemedText>
												</View>
											</View>
										</View>
									);
								})}
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
	section: {
		gap: Spacing.two,
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingTop: Spacing.four,
	},
	sectionTitle: {
		fontSize: 13,
		lineHeight: 18,
		fontWeight: "400",
		textTransform: "uppercase",
		letterSpacing: 1,
		marginBottom: Spacing.one,
	},
	grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three },
	stat: { width: "47%", flexGrow: 1, gap: 2, paddingVertical: Spacing.two },
	statValue: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rank: { width: 18 },
	rowInfo: { flex: 1, gap: 2 },
	rowValue: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
	subValue: { fontSize: 16, fontWeight: "700" },
	matchNum: { width: 30 },
	matchLines: { flex: 1, gap: Spacing.one },
	matchLine: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
	},
	matchSide: { flex: 1 },
	matchWinner: { fontWeight: "700" },
	empty: { textAlign: "center", marginTop: Spacing.five },
	emptyBox: { alignItems: "center", gap: Spacing.three, marginTop: Spacing.five },
});
