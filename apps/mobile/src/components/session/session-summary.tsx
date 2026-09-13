import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { MobileHeader } from "@/components/mobile-header";
import { formatDuration, rotationLabel } from "@/components/session/utils";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

function formatDate(value: Date | string) {
	return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SessionSummaryView({ sessionId }: { sessionId: string }) {
	const theme = useTheme();
	const trpc = useTRPC();
	const query = useQuery(trpc.session.getSummary.queryOptions({ sessionId }));
	const summary = query.data;

	const players = [...(summary?.playerStats ?? [])].sort((a, b) => b.wins - a.wins);
	const mvp = players[0];
	const combos = summary?.teamCombos ?? [];
	const bestCombo = combos[0];
	const worstCombo = combos.length > 1 ? combos[combos.length - 1] : undefined;

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
					<ScrollView contentContainerStyle={styles.scroll}>
						<View style={styles.grid}>
							<Card style={styles.statCard}>
								<CardContent>
									<ThemedText type="small" themeColor="textSecondary">
										Session
									</ThemedText>
									<ThemedText type="smallBold" style={styles.statValue}>
										{formatDate(summary.createdAt)}
									</ThemedText>
									<ThemedText type="small" themeColor="textSecondary">
										{formatDuration(summary.createdAt, summary.endedAt)} ·{" "}
										{rotationLabel(summary.rotationMode)}
									</ThemedText>
								</CardContent>
							</Card>
							<Card style={styles.statCard}>
								<CardContent>
									<ThemedText type="small" themeColor="textSecondary">
										Matches
									</ThemedText>
									<ThemedText type="smallBold" style={styles.statValue}>
										{summary.totalMatches}
									</ThemedText>
									<ThemedText type="small" themeColor="textSecondary">
										{summary.playerStats.length} players
									</ThemedText>
								</CardContent>
							</Card>
							<Card style={styles.statCard}>
								<CardContent>
									<ThemedText type="small" themeColor="textSecondary">
										MVP
									</ThemedText>
									{mvp ? (
										<View style={styles.mvpRow}>
											<Avatar
												name={mvp.displayName}
												image={getAvatarUri(mvp.playerImage)}
												size={20}
											/>
											<ThemedText type="smallBold" numberOfLines={1} style={styles.mvpName}>
												{mvp.displayName}
											</ThemedText>
										</View>
									) : (
										<ThemedText type="small" themeColor="textSecondary">
											No matches played
										</ThemedText>
									)}
									{mvp ? (
										<ThemedText type="small" themeColor="textSecondary">
											{mvp.wins}W · {mvp.gamesPlayedThisSession}G
										</ThemedText>
									) : null}
								</CardContent>
							</Card>
							<Card style={styles.statCard}>
								<CardContent>
									<ThemedText type="small" themeColor="textSecondary">
										Teams
									</ThemedText>
									{bestCombo ? (
										<>
											<ThemedText type="smallBold" numberOfLines={1}>
												{bestCombo.players.map((p) => p.displayName.split(" ")[0]).join(" & ")}
											</ThemedText>
											<ThemedText type="small" style={{ color: "#22c55e" }}>
												{bestCombo.winRate}% best
											</ThemedText>
											{worstCombo ? (
												<ThemedText type="small" style={{ color: "#ef4444" }}>
													{worstCombo.players.map((p) => p.displayName.split(" ")[0]).join(" & ")} ·{" "}
													{worstCombo.winRate}%
												</ThemedText>
											) : null}
										</>
									) : (
										<ThemedText type="small" themeColor="textSecondary">
											No team data
										</ThemedText>
									)}
								</CardContent>
							</Card>
						</View>

						<Card>
							<CardContent>
								<ThemedText type="smallBold" style={styles.sectionTitle}>
									Player Standings
								</ThemedText>
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
											<Avatar name={p.displayName} image={getAvatarUri(p.playerImage)} size={24} />
											<ThemedText style={styles.playerName} numberOfLines={1}>
												{p.displayName}
											</ThemedText>
											<ThemedText type="small" themeColor="textSecondary">
												{p.gamesPlayedThisSession}G
											</ThemedText>
											<ThemedText type="small" style={{ color: "#22c55e" }}>
												{p.wins}W
											</ThemedText>
											<ThemedText type="small" style={{ color: "#ef4444" }}>
												{p.losses}L
											</ThemedText>
											{delta != null ? (
												<ThemedText
													type="small"
													style={{ color: delta >= 0 ? "#22c55e" : "#ef4444" }}
												>
													{delta >= 0 ? `+${delta}` : delta}
												</ThemedText>
											) : null}
										</View>
									);
								})}
							</CardContent>
						</Card>

						{summary.matchFeed.length > 0 ? (
							<Card>
								<CardContent>
									<ThemedText type="smallBold" style={styles.sectionTitle}>
										Match-by-Match
									</ThemedText>
									{summary.matchFeed.map((m) => {
										const homeWon = m.homeScore > m.awayScore;
										const awayWon = m.awayScore > m.homeScore;
										return (
											<View
												key={m.matchNumber}
												style={[styles.match, { borderBottomColor: theme.border }]}
											>
												<ThemedText type="small" themeColor="textSecondary" style={styles.rank}>
													#{m.matchNumber}
												</ThemedText>
												<View style={styles.matchLines}>
													<View style={styles.matchLine}>
														<ThemedText
															type="small"
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
															themeColor={homeWon ? "textSecondary" : "text"}
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
								</CardContent>
							</Card>
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
	scroll: { gap: Spacing.three, paddingBottom: Spacing.four },
	grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
	statCard: { width: "48%", flexGrow: 1 },
	statValue: { fontSize: 20, lineHeight: 26 },
	mvpRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one, marginTop: Spacing.one },
	mvpName: { flex: 1 },
	sectionTitle: { marginBottom: Spacing.two },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rank: { width: 22 },
	playerName: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "500" },
	match: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	matchLines: { flex: 1, gap: 2 },
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
