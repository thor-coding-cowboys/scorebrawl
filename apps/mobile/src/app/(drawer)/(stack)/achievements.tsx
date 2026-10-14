import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { SectionCard } from "@/components/ui/section-card";
import { SkeletonListRow } from "@/components/ui/skeleton-rows";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getAvatarUri, useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { achievementCatalog, getAchievement } from "@coding-cowboys/scorebrawl-core/achievements";
import { achievementIcons } from "@/lib/achievements";
import { useTRPC, type RouterOutput } from "@/lib/trpc";

const ACHIEVEMENT_ENTRIES = Object.entries(achievementCatalog);
const ACHIEVEMENT_ROWS = Array.from({ length: Math.ceil(ACHIEVEMENT_ENTRIES.length / 2) }, (_, i) =>
	ACHIEVEMENT_ENTRIES.slice(i * 2, i * 2 + 2)
);

type BoardRow = RouterOutput["achievement"]["getLeagueBoard"][number];

interface PlayerStats {
	playerId: string;
	name: string;
	image: string | null;
	count: number;
	types: string[];
}

export default function AchievementsScreen() {
	const trpc = useTRPC();
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const boardQuery = useQuery(trpc.achievement.getLeagueBoard.queryOptions());
	const { refreshing, onRefresh } = usePullToRefresh(() => boardQuery.refetch());

	const byType = new Map<string, BoardRow[]>();
	const byPlayer = new Map<string, PlayerStats>();
	for (const row of boardQuery.data ?? []) {
		byType.set(row.type, [...(byType.get(row.type) ?? []), row]);
		const existing = byPlayer.get(row.playerId);
		if (existing) {
			existing.count += 1;
			existing.types.push(row.type);
		} else {
			byPlayer.set(row.playerId, {
				playerId: row.playerId,
				name: row.name,
				image: row.image,
				count: 1,
				types: [row.type],
			});
		}
	}
	const decorated = [...byPlayer.values()].sort((a, b) => b.count - a.count);

	return (
		<ScrollView
			contentContainerStyle={styles.scroll}
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
		>
			<SectionCard title="Most Decorated Players">
				{boardQuery.isPending ? (
					Array.from({ length: 3 }).map((_, i) => <SkeletonListRow key={i} />)
				) : decorated.length === 0 ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						No achievements earned in this league yet
					</ThemedText>
				) : (
					decorated.map((player, index) => (
						<Pressable
							key={player.playerId}
							accessibilityRole="button"
							onPress={() =>
								router.push({
									pathname: "/players/[playerId]",
									params: { playerId: player.playerId },
								})
							}
							style={({ pressed }) => [
								styles.playerRow,
								index > 0 && {
									borderTopColor: theme.border,
									borderTopWidth: StyleSheet.hairlineWidth,
								},
								pressed && styles.pressed,
							]}
						>
							<ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
								{index + 1}
							</ThemedText>
							<Avatar
								name={player.name}
								image={getAvatarUri(player.image)}
								headers={headers}
								size={36}
							/>
							<View style={styles.playerInfo}>
								<ThemedText type="smallBold" numberOfLines={1}>
									{player.name}
								</ThemedText>
								<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
									{player.types
										.map((t) => getAchievement(t)?.name)
										.filter(Boolean)
										.join(" · ")}
								</ThemedText>
							</View>
							<ThemedText style={styles.count}>{player.count}</ThemedText>
						</Pressable>
					))
				)}
			</SectionCard>

			<SectionCard title="League Achievements">
				<View style={styles.grid}>
					{ACHIEVEMENT_ROWS.map((row) => (
						<View key={row.map(([type]) => type).join("|")} style={styles.gridRow}>
							{row.map(([type, meta]) => {
								const holders = byType.get(type) ?? [];
								const earned = holders.length > 0;
								return (
									<View key={type} style={[styles.achievement, { borderColor: theme.border }]}>
										<View style={styles.achievementHead}>
											<SymbolView
												name={achievementIcons[meta.iconKey]}
												size={22}
												tintColor={earned ? theme.primary : `${theme.textSecondary}66`}
											/>
											<View style={styles.achievementText}>
												<ThemedText type="smallBold">{meta.name}</ThemedText>
												<ThemedText
													type="small"
													themeColor="textSecondary"
													style={styles.description}
												>
													{meta.description}
												</ThemedText>
											</View>
										</View>
										{earned ? (
											<View style={styles.holders}>
												{holders.map((h, i) => (
													<View
														key={`${h.playerId}-${String(i)}`}
														style={[
															styles.holder,
															i > 0 && styles.holderOverlap,
															{ borderColor: theme.surface },
														]}
													>
														<Avatar
															name={h.name}
															image={getAvatarUri(h.image)}
															headers={headers}
															size={26}
														/>
													</View>
												))}
											</View>
										) : (
											<ThemedText type="small" themeColor="textSecondary" style={styles.nobody}>
												Nobody yet
											</ThemedText>
										)}
									</View>
								);
							})}
							{row.length === 1 ? <View style={styles.achievementSpacer} /> : null}
						</View>
					))}
				</View>
			</SectionCard>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	scroll: {
		width: "100%",
		maxWidth: MaxContentWidth,
		alignSelf: "center",
		padding: Spacing.three,
		gap: Spacing.three,
	},
	empty: {
		textAlign: "center",
		paddingVertical: Spacing.four,
	},
	playerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
	},
	rank: {
		width: 20,
	},
	playerInfo: {
		flex: 1,
	},
	count: {
		fontSize: 18,
		fontWeight: "700",
	},
	pressed: {
		opacity: 0.6,
	},
	grid: {
		gap: Spacing.two,
		paddingBottom: Spacing.two,
	},
	gridRow: {
		flexDirection: "row",
		gap: Spacing.two,
	},
	achievementSpacer: {
		flex: 1,
	},
	achievement: {
		flex: 1,
		borderWidth: StyleSheet.hairlineWidth,
		padding: Spacing.three,
		gap: Spacing.two,
	},
	achievementHead: {
		gap: Spacing.two,
	},
	achievementText: {
		gap: 2,
	},
	description: {
		fontSize: 12,
		lineHeight: 16,
	},
	holders: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	holder: {
		borderWidth: 2,
		borderRadius: 4,
	},
	holderOverlap: {
		marginLeft: -6,
	},
	nobody: {
		fontSize: 12,
	},
});
