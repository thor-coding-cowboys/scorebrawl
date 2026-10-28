import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useId, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Avatar } from "@/components/avatar";
import { CreateSeasonForm } from "@/components/create-season-form";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spacing } from "@/constants/theme";
import { getAvatarUri, useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC, type RouterOutput } from "@/lib/trpc";

type Summary = RouterOutput["season"]["getSummary"];
type PlayerRef = Summary["champions"][number];
type SymbolName = Parameters<typeof SymbolView>[0]["name"];
type Theme = ReturnType<typeof useTheme>;

interface PodiumEntry {
	id: string;
	rank: number;
	name: string;
	image: string | null;
	score: number;
	matchCount: number;
	winCount: number;
	lossCount: number;
	drawCount: number;
	winRate: number;
	players?: { id: string; name: string; image: string | null }[];
}

interface Moment {
	key: string;
	label: string;
	icon: SymbolName;
	accent: string;
	value: string;
	unit: string;
	players: PlayerRef[];
	caption: string;
	detail?: string;
}

const CROWN: SymbolName = { ios: "crown.fill", android: "emoji_events", web: "emoji_events" };
const STEP_HEIGHT: Record<number, number> = { 1: 124, 2: 104, 3: 92 };
const STEP_ORDER: Record<number, number> = { 1: 2, 2: 1, 3: 3 };

const placeColor = (theme: Theme, rank: number) =>
	rank === 1 ? theme.glowAmberSolid : rank === 2 ? theme.mutedForeground : theme.avatar6Text;

const record = ({ winCount, drawCount, lossCount }: PodiumEntry) =>
	drawCount > 0 ? `${winCount}-${drawCount}-${lossCount}` : `${winCount}-${lossCount}`;

const names = (players: PlayerRef[]) => players.map((p) => p.name).join(" & ");

function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
	return (
		<ThemedText
			themeColor="mutedForeground"
			style={[styles.eyebrow, color ? { color } : null]}
			numberOfLines={1}
		>
			{children}
		</ThemedText>
	);
}

function AvatarStack({
	players,
	size,
}: {
	players: { id: string; name: string; image: string | null }[];
	size: number;
}) {
	const { headers } = useUserAvatar();
	return (
		<View style={styles.avatarStack}>
			{players.slice(0, 2).map((p) => (
				<Avatar
					key={p.id}
					name={p.name}
					image={getAvatarUri(p.image)}
					headers={headers}
					size={size}
				/>
			))}
		</View>
	);
}

function GradientFill({
	color,
	opacity = 0.16,
	diagonal = false,
}: {
	color: string;
	opacity?: number;
	diagonal?: boolean;
}) {
	const id = useId();
	return (
		<Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
			<Defs>
				<LinearGradient id={id} x1="0" y1="0" x2={diagonal ? "1" : "0"} y2="1">
					<Stop offset="0" stopColor={color} stopOpacity={opacity} />
					<Stop offset="1" stopColor={color} stopOpacity={0} />
				</LinearGradient>
			</Defs>
			<Rect width="100%" height="100%" fill={`url(#${id})`} />
		</Svg>
	);
}

function HeroStat({
	label,
	value,
	style,
}: {
	label: string;
	value: string;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[styles.heroStat, style]}>
			<Eyebrow>{label}</Eyebrow>
			<ThemedText style={styles.heroStatValue}>{value}</ThemedText>
		</View>
	);
}

function ChampionHero({
	seasonName,
	summary,
	canStartNextSeason,
	onStartNextSeason,
}: {
	seasonName: string;
	summary: Summary;
	canStartNextSeason: boolean;
	onStartNextSeason: () => void;
}) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const champion = summary.podium[0];
	const hasChampion = summary.champions.length > 0 && !!champion;
	const isTie = summary.champions.length > 1;
	const divider = { borderColor: theme.border };

	return (
		<View
			style={[styles.card, { backgroundColor: theme.card, borderColor: theme.glowAmberBorder }]}
		>
			<GradientFill color={theme.glowAmberSolid} opacity={0.14} diagonal />
			<View style={styles.heroBody}>
				{hasChampion ? (
					<View style={styles.heroAvatar}>
						{isTie ? (
							<AvatarStack players={summary.champions} size={56} />
						) : (
							<View style={[styles.heroAvatarRing, { borderColor: theme.glowAmberSolid }]}>
								<Avatar
									name={champion.name}
									image={getAvatarUri(champion.image)}
									headers={headers}
									size={60}
								/>
							</View>
						)}
						<View style={[styles.crownBadge, { backgroundColor: theme.glowAmberSolid }]}>
							<SymbolView name={CROWN} size={12} tintColor="#ffffff" />
						</View>
					</View>
				) : null}
				<View style={styles.heroText}>
					<Eyebrow color={theme.glowAmberText}>
						{seasonName} · {isTie ? "Co-champions" : "Champion"}
					</Eyebrow>
					<ThemedText style={styles.championName}>
						{hasChampion ? names(summary.champions) : "No champion crowned"}
					</ThemedText>
					{!hasChampion ? (
						<ThemedText type="small" themeColor="mutedForeground">
							No matches were played this season.
						</ThemedText>
					) : null}
				</View>
				{canStartNextSeason ? (
					<Button
						fullWidth
						icon={{ ios: "plus", android: "add", web: "add" }}
						onPress={onStartNextSeason}
					>
						Start next season
					</Button>
				) : null}
			</View>
			{hasChampion ? (
				<View style={[styles.heroStats, { borderColor: theme.glowAmberBorder }]}>
					<View style={styles.heroStatsRow}>
						<HeroStat label="Points" value={String(champion.score)} />
						<HeroStat label="Record" value={record(champion)} style={[styles.leftRule, divider]} />
					</View>
					<View style={[styles.heroStatsRow, styles.topRule, divider]}>
						<HeroStat label="Win rate" value={`${champion.winRate}%`} />
						<HeroStat
							label="Matches"
							value={String(champion.matchCount)}
							style={[styles.leftRule, divider]}
						/>
					</View>
				</View>
			) : null}
		</View>
	);
}

function PodiumColumn({ entry }: { entry: PodiumEntry }) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const color = placeColor(theme, entry.rank);
	const isWinner = entry.rank === 1;
	return (
		<View style={styles.podiumColumn}>
			<View style={styles.podiumIdentity}>
				{entry.players && entry.players.length > 0 ? (
					<AvatarStack players={entry.players} size={isWinner ? 36 : 30} />
				) : (
					<Avatar
						name={entry.name}
						image={getAvatarUri(entry.image)}
						headers={headers}
						size={isWinner ? 52 : 40}
					/>
				)}
				<ThemedText style={styles.podiumName} numberOfLines={3}>
					{entry.name}
				</ThemedText>
			</View>
			<View
				style={[
					styles.step,
					{
						height: STEP_HEIGHT[entry.rank] ?? 72,
						borderColor: theme.border,
						borderTopColor: color,
					},
				]}
			>
				<GradientFill color={color} />
				<ThemedText style={[styles.stepRank, { color }]}>{entry.rank}</ThemedText>
				<ThemedText style={styles.stepScore}>{entry.score}</ThemedText>
				<ThemedText themeColor="mutedForeground" style={styles.stepMeta} numberOfLines={1}>
					{record(entry)} · {entry.winRate}%
				</ThemedText>
			</View>
		</View>
	);
}

function Podium({ title, entries }: { title: string; entries: PodiumEntry[] }) {
	const theme = useTheme();
	return (
		<View
			style={[
				styles.card,
				styles.padded,
				{ backgroundColor: theme.card, borderColor: theme.border },
			]}
		>
			<View style={styles.headingRow}>
				<Eyebrow>{title}</Eyebrow>
				<ThemedText themeColor="mutedForeground" style={styles.legend}>
					pts · W-L · win %
				</ThemedText>
			</View>
			<View style={styles.podiumRow}>
				{[...entries]
					.sort((a, b) => (STEP_ORDER[a.rank] ?? 3) - (STEP_ORDER[b.rank] ?? 3))
					.map((entry) => (
						<PodiumColumn key={entry.id} entry={entry} />
					))}
			</View>
		</View>
	);
}

function MomentTile({ moment }: { moment: Moment }) {
	const theme = useTheme();
	return (
		<View
			style={[
				styles.card,
				styles.padded,
				styles.moment,
				{ backgroundColor: theme.card, borderColor: theme.border },
			]}
		>
			<View style={styles.headingRow}>
				<Eyebrow>{moment.label}</Eyebrow>
				<View style={[styles.momentIcon, { backgroundColor: `${moment.accent}1a` }]}>
					<SymbolView name={moment.icon} size={14} tintColor={moment.accent} />
				</View>
			</View>
			<View style={styles.momentValueRow}>
				<ThemedText style={styles.momentValue}>{moment.value}</ThemedText>
				<ThemedText type="small" themeColor="mutedForeground" style={styles.caption}>
					{moment.unit}
				</ThemedText>
			</View>
			<View style={[styles.momentFooter, { borderColor: theme.border }]}>
				<AvatarStack players={moment.players} size={24} />
				<View style={styles.flex}>
					<ThemedText type="smallBold" style={styles.caption} numberOfLines={2}>
						{moment.caption}
					</ThemedText>
					{moment.detail ? (
						<ThemedText
							type="small"
							themeColor="mutedForeground"
							style={styles.caption}
							numberOfLines={2}
						>
							{moment.detail}
						</ThemedText>
					) : null}
				</View>
			</View>
		</View>
	);
}

function buildMoments(
	theme: Theme,
	{ longestWinStreak, biggestUpset, biggestGain, mostMatches }: Summary["highlights"]
) {
	const moments: Moment[] = [];
	if (longestWinStreak) {
		moments.push({
			key: "streak",
			label: "Longest streak",
			icon: { ios: "flame.fill", android: "local_fire_department", web: "local_fire_department" },
			accent: theme.glowRedSolid,
			value: String(longestWinStreak.length),
			unit: "wins in a row",
			players: [longestWinStreak.player],
			caption: longestWinStreak.player.name,
		});
	}
	if (biggestUpset) {
		moments.push({
			key: "upset",
			label: "Biggest upset",
			icon: { ios: "bolt.fill", android: "bolt", web: "bolt" },
			accent: theme.glowPurpleSolid,
			value: `${Math.round(biggestUpset.winnerOdds * 100)}%`,
			unit: "win odds",
			players: biggestUpset.winners,
			caption: names(biggestUpset.winners),
			detail: `${biggestUpset.winnerScore}–${biggestUpset.loserScore} vs ${names(biggestUpset.losers)}`,
		});
	}
	if (biggestGain) {
		moments.push({
			key: "gain",
			label: "Biggest swing",
			icon: { ios: "chart.line.uptrend.xyaxis", android: "trending_up", web: "trending_up" },
			accent: theme.glowEmeraldSolid,
			value: `+${biggestGain.gain}`,
			unit: "pts in one match",
			players: [biggestGain.player],
			caption: biggestGain.player.name,
		});
	}
	if (mostMatches) {
		moments.push({
			key: "matches",
			label: "Iron player",
			icon: { ios: "gamecontroller.fill", android: "sports_esports", web: "sports_esports" },
			accent: theme.glowBlueSolid,
			value: String(mostMatches.matchCount),
			unit: "matches played",
			players: [mostMatches.player],
			caption: mostMatches.player.name,
		});
	}
	return moments;
}

export function SeasonCeremony({
	seasonSlug,
	seasonName,
	canStartNextSeason,
}: {
	seasonSlug: string;
	seasonName: string;
	canStartNextSeason: boolean;
}) {
	const trpc = useTRPC();
	const theme = useTheme();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));

	if (!summary) return <Skeleton width="100%" height={180} />;

	const moments = buildMoments(theme, summary.highlights);

	return (
		<View style={styles.container}>
			<ChampionHero
				seasonName={seasonName}
				summary={summary}
				canStartNextSeason={canStartNextSeason}
				onStartNextSeason={() => setIsCreateOpen(true)}
			/>
			{summary.matchCount > 0 ? (
				<>
					<Podium title="Player podium" entries={summary.podium} />
					{summary.teamPodium.length > 0 ? (
						<Podium
							title="Team podium"
							entries={summary.teamPodium.map((t) => ({ ...t, image: t.logo }))}
						/>
					) : null}
					{moments.length > 0 ? (
						<View style={styles.moments}>
							<View style={styles.headingRow}>
								<Eyebrow>Season highlights</Eyebrow>
								<ThemedText themeColor="mutedForeground" style={styles.legend}>
									{summary.matchCount} matches · {summary.playerCount} players
								</ThemedText>
							</View>
							{moments.map((moment) => (
								<MomentTile key={moment.key} moment={moment} />
							))}
						</View>
					) : null}
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
		minWidth: 0,
	},
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	padded: {
		padding: Spacing.three,
		gap: Spacing.three,
	},
	eyebrow: {
		fontSize: 10,
		lineHeight: 14,
		fontWeight: "700",
		letterSpacing: 1.4,
		textTransform: "uppercase",
	},
	legend: {
		fontSize: 10,
		lineHeight: 14,
	},
	caption: {
		fontSize: 12,
		lineHeight: 16,
	},
	headingRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
	},
	heroBody: {
		padding: Spacing.three,
		gap: Spacing.three,
	},
	heroAvatar: {
		alignSelf: "flex-start",
	},
	heroAvatarRing: {
		borderWidth: 2,
		borderRadius: 10,
		padding: 2,
	},
	crownBadge: {
		position: "absolute",
		top: -8,
		right: -8,
		width: 22,
		height: 22,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
	},
	heroText: {
		gap: Spacing.one,
	},
	championName: {
		fontSize: 26,
		lineHeight: 32,
		fontWeight: "700",
	},
	heroStats: {
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	heroStatsRow: {
		flexDirection: "row",
	},
	heroStat: {
		flex: 1,
		gap: 4,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two + 2,
	},
	heroStatValue: {
		fontSize: 18,
		lineHeight: 22,
		fontWeight: "700",
		fontVariant: ["tabular-nums"],
	},
	leftRule: {
		borderLeftWidth: StyleSheet.hairlineWidth,
	},
	topRule: {
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	avatarStack: {
		flexDirection: "row",
		gap: 4,
	},
	podiumRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: Spacing.two,
	},
	podiumColumn: {
		flex: 1,
		minWidth: 0,
		alignItems: "center",
	},
	podiumIdentity: {
		alignItems: "center",
		gap: Spacing.two,
		paddingBottom: Spacing.two,
		width: "100%",
	},
	podiumName: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: "700",
		textAlign: "center",
	},
	step: {
		width: "100%",
		alignItems: "center",
		gap: 2,
		paddingTop: Spacing.two,
		borderWidth: StyleSheet.hairlineWidth,
		borderTopWidth: 2,
		overflow: "hidden",
	},
	stepRank: {
		fontSize: 28,
		lineHeight: 32,
		fontWeight: "900",
	},
	stepScore: {
		fontSize: 14,
		lineHeight: 18,
		fontWeight: "700",
		fontVariant: ["tabular-nums"],
	},
	stepMeta: {
		fontSize: 10,
		lineHeight: 13,
		fontVariant: ["tabular-nums"],
	},
	moments: {
		gap: Spacing.two,
	},
	moment: {
		gap: Spacing.two,
	},
	momentIcon: {
		width: 26,
		height: 26,
		borderRadius: 6,
		alignItems: "center",
		justifyContent: "center",
	},
	momentValueRow: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 6,
	},
	momentValue: {
		fontSize: 28,
		lineHeight: 34,
		fontWeight: "700",
		fontVariant: ["tabular-nums"],
	},
	momentFooter: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingTop: Spacing.two,
	},
});
