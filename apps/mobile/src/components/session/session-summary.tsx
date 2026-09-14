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
					<ScrollView contentContainerStyle={styles.scroll}>
						<Card>
							<CardContent style={styles.cardContent}>
								<ThemedText type="smallBold" style={styles.sectionTitle}>
									Session
								</ThemedText>
								<InfoRow label="Date" value={formatDate(summary.createdAt)} />
								<InfoRow
									label="Duration"
									value={formatDuration(summary.createdAt, summary.endedAt)}
									sub={rotationLabel(summary.rotationMode)}
								/>
								<InfoRow label="Matches" value={String(summary.totalMatches)} />
								<InfoRow label="Players" value={String(summary.playerStats.length)} />
								<InfoRow
									label="MVP"
									value={mvp ? mvp.displayName : "—"}
									sub={mvp ? `${mvp.wins}W · ${mvp.gamesPlayedThisSession}G` : "No matches played"}
								/>
								<InfoRow
									label="Best team"
									value={bestCombo ? comboName(bestCombo) : "—"}
									sub={bestCombo ? `${bestCombo.winRate}% win rate` : "No team data"}
								/>
								{worstCombo ? (
									<InfoRow
										label="Worst team"
										value={comboName(worstCombo)}
										sub={`${worstCombo.winRate}% win rate`}
									/>
								) : null}
							</CardContent>
						</Card>

						<Card>
							<CardContent style={styles.cardContent}>
								<ThemedText type="smallBold" style={styles.sectionTitle}>
									Player standings
								</ThemedText>
								{players.map((p, i) => {
									const delta =
										p.scoreBeforeSession != null && p.scoreAfterSession != null
											? p.scoreAfterSession - p.scoreBeforeSession
											: null;
									return (
										<View
											key={p.seasonPlayerId}
											style={[styles.playerRow, { borderBottomColor: theme.border }]}
										>
											<ThemedText type="small" themeColor="textSecondary" style={styles.rank}>
												{i + 1}
											</ThemedText>
											<Avatar name={p.displayName} image={getAvatarUri(p.playerImage)} size={32} />
											<View style={styles.playerInfo}>
												<ThemedText style={styles.playerName} numberOfLines={1}>
													{p.displayName}
												</ThemedText>
												<ThemedText type="small" themeColor="textSecondary">
													{p.gamesPlayedThisSession}G · {p.wins}W · {p.losses}L
												</ThemedText>
											</View>
											{delta != null ? (
												<ThemedText
													style={[styles.rowValue, { color: delta >= 0 ? "#22c55e" : "#ef4444" }]}
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
								<CardContent style={styles.cardContent}>
									<ThemedText type="smallBold" style={styles.sectionTitle}>
										Match-by-match
									</ThemedText>
									{summary.matchFeed.map((m) => {
										const homeWon = m.homeScore > m.awayScore;
										const awayWon = m.awayScore > m.homeScore;
										return (
											<View
												key={m.matchNumber}
												style={[styles.matchRow, { borderBottomColor: theme.border }]}
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
	scroll: { gap: Spacing.four, paddingBottom: Spacing.six },
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
	playerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rank: { width: 18 },
	playerInfo: { flex: 1, gap: 2 },
	playerName: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
	matchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
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
