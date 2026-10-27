import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { CreateSeasonForm } from "@/components/create-season-form";
import { DashboardCard } from "@/components/season/dashboard-cards";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { CardGlow } from "@/components/ui/card-glow";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spacing } from "@/constants/theme";
import { getAvatarUri, useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC, type RouterOutput } from "@/lib/trpc";

type Summary = RouterOutput["season"]["getSummary"];
type SymbolName = Parameters<typeof SymbolView>[0]["name"];

interface PodiumEntry {
	id: string;
	rank: number;
	name: string;
	image: string | null;
	score: number;
	matchCount: number;
	winRate: number;
}

const MEDAL: SymbolName = { ios: "medal.fill", android: "military_tech", web: "military_tech" };
const CROWN: SymbolName = { ios: "crown.fill", android: "emoji_events", web: "emoji_events" };

function Podium({ title, entries }: { title: string; entries: PodiumEntry[] }) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const medalColors: Record<number, string> = {
		1: theme.glowAmberSolid,
		2: theme.mutedForeground,
		3: theme.glowRedSolid,
	};
	return (
		<SectionCard title={title}>
			{entries.map((entry) => (
				<View
					key={entry.id}
					style={[
						styles.podiumRow,
						{ borderColor: entry.rank === 1 ? theme.glowAmberBorder : theme.border },
					]}
				>
					<View style={styles.podiumRank}>
						<SymbolView
							name={MEDAL}
							size={16}
							tintColor={medalColors[entry.rank] ?? theme.mutedForeground}
						/>
						<ThemedText type="smallBold">#{entry.rank}</ThemedText>
					</View>
					<Avatar
						name={entry.name}
						image={getAvatarUri(entry.image)}
						headers={headers}
						size={entry.rank === 1 ? 44 : 36}
					/>
					<View style={styles.flex}>
						<ThemedText type="smallBold" numberOfLines={1}>
							{entry.name}
						</ThemedText>
						<ThemedText type="small" themeColor="mutedForeground" style={styles.caption}>
							{entry.matchCount} matches · {entry.winRate}% wins
						</ThemedText>
					</View>
					<ThemedText style={styles.score}>{entry.score}</ThemedText>
				</View>
			))}
		</SectionCard>
	);
}

function ChampionBanner({
	summary,
	canStartNextSeason,
	onStartNextSeason,
}: {
	summary: Summary;
	canStartNextSeason: boolean;
	onStartNextSeason: () => void;
}) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const champion = summary.podium[0];
	const hasChampion = summary.champions.length > 0 && !!champion;
	return (
		<View
			style={[styles.banner, { backgroundColor: theme.card, borderColor: theme.glowAmberBorder }]}
		>
			<CardGlow color={theme.glowAmberSolid} />
			<View style={styles.bannerRow}>
				{champion ? (
					<Avatar
						name={champion.name}
						image={getAvatarUri(champion.image)}
						headers={headers}
						size={56}
					/>
				) : null}
				<View style={styles.flex}>
					<View style={styles.bannerLabel}>
						<SymbolView name={CROWN} size={14} tintColor={theme.glowAmberText} />
						<ThemedText type="smallBold" style={{ color: theme.glowAmberText }}>
							{summary.champions.length > 1 ? "SEASON CO-CHAMPIONS" : "SEASON CHAMPION"}
						</ThemedText>
					</View>
					<ThemedText style={styles.championName} numberOfLines={2}>
						{hasChampion ? summary.champions.map((c) => c.name).join(" & ") : "No champion"}
					</ThemedText>
					<ThemedText type="small" themeColor="mutedForeground" style={styles.caption}>
						{hasChampion
							? `${champion.score} points · ${champion.matchCount} matches · ${champion.winRate}% win rate`
							: "No matches were played this season"}
					</ThemedText>
				</View>
			</View>
			{canStartNextSeason ? (
				<Button
					size="sm"
					icon={{ ios: "plus", android: "add", web: "add" }}
					onPress={onStartNextSeason}
				>
					Start next season
				</Button>
			) : null}
		</View>
	);
}

function Highlights({ highlights }: { highlights: Summary["highlights"] }) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const { longestWinStreak, biggestUpset, biggestGain, mostMatches } = highlights;
	const items = [
		longestWinStreak && {
			title: "Longest Streak",
			icon: { ios: "flame.fill", android: "local_fire_department", web: "local_fire_department" },
			accent: theme.glowRedSolid,
			player: longestWinStreak.player,
			label: longestWinStreak.player.name,
			detail: `${longestWinStreak.length} wins in a row`,
		},
		biggestUpset && {
			title: "Biggest Upset",
			icon: { ios: "bolt.fill", android: "bolt", web: "bolt" },
			accent: theme.glowPurpleSolid,
			player: biggestUpset.winners[0],
			label: biggestUpset.winners.map((p) => p.name).join(" & "),
			detail: `${biggestUpset.winnerScore}–${biggestUpset.loserScore} vs ${biggestUpset.losers.map((p) => p.name).join(" & ")} (${Math.round(biggestUpset.winnerOdds * 100)}% odds)`,
		},
		biggestGain && {
			title: "Biggest Gain",
			icon: { ios: "chart.line.uptrend.xyaxis", android: "trending_up", web: "trending_up" },
			accent: theme.glowEmeraldSolid,
			player: biggestGain.player,
			label: biggestGain.player.name,
			detail: `+${biggestGain.gain} points in one match`,
		},
		mostMatches && {
			title: "Most Matches",
			icon: { ios: "gamecontroller.fill", android: "sports_esports", web: "sports_esports" },
			accent: theme.glowBlueSolid,
			player: mostMatches.player,
			label: mostMatches.player.name,
			detail: `${mostMatches.matchCount} matches played`,
		},
	].filter((item) => !!item);

	if (items.length === 0) return null;

	return (
		<View style={styles.highlights}>
			<ThemedText type="smallBold" themeColor="mutedForeground">
				Biggest moments
			</ThemedText>
			{items.map((item) => (
				<DashboardCard
					key={item.title}
					title={item.title}
					icon={item.icon as SymbolName}
					accent={item.accent}
				>
					<View style={styles.highlightRow}>
						{item.player ? (
							<Avatar
								name={item.player.name}
								image={getAvatarUri(item.player.image)}
								headers={headers}
								size={36}
							/>
						) : null}
						<View style={styles.flex}>
							<ThemedText type="smallBold" numberOfLines={1}>
								{item.label}
							</ThemedText>
							<ThemedText type="small" themeColor="mutedForeground" style={styles.caption}>
								{item.detail}
							</ThemedText>
						</View>
					</View>
				</DashboardCard>
			))}
		</View>
	);
}

export function SeasonCeremony({
	seasonSlug,
	canStartNextSeason,
}: {
	seasonSlug: string;
	canStartNextSeason: boolean;
}) {
	const trpc = useTRPC();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));

	if (!summary) return <Skeleton width="100%" height={120} />;

	return (
		<View style={styles.container}>
			<ChampionBanner
				summary={summary}
				canStartNextSeason={canStartNextSeason}
				onStartNextSeason={() => setIsCreateOpen(true)}
			/>
			{summary.matchCount > 0 ? (
				<>
					<Podium title="Player Podium" entries={summary.podium} />
					{summary.teamPodium.length > 0 ? (
						<Podium
							title="Team Podium"
							entries={summary.teamPodium.map((t) => ({ ...t, image: t.logo }))}
						/>
					) : null}
					<Highlights highlights={summary.highlights} />
				</>
			) : null}
			{canStartNextSeason ? (
				<CreateSeasonForm
					isOpen={isCreateOpen}
					onClose={() => setIsCreateOpen(false)}
					onSuccess={(newSeasonSlug) =>
						router.replace({
							pathname: "/seasons/[seasonSlug]",
							params: { seasonSlug: newSeasonSlug },
						})
					}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		gap: Spacing.three,
	},
	flex: {
		flex: 1,
	},
	caption: {
		fontSize: 12,
		lineHeight: 16,
	},
	banner: {
		borderWidth: 1,
		padding: Spacing.three,
		gap: Spacing.three,
		overflow: "hidden",
	},
	bannerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
	},
	bannerLabel: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
	},
	championName: {
		fontSize: 22,
		lineHeight: 28,
		fontWeight: "700",
	},
	podiumRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		borderWidth: StyleSheet.hairlineWidth,
		padding: Spacing.two,
		marginBottom: Spacing.two,
	},
	podiumRank: {
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
		width: 44,
	},
	score: {
		fontSize: 18,
		fontWeight: "700",
	},
	highlights: {
		gap: Spacing.two,
	},
	highlightRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
});
