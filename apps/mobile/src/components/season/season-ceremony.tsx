import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useId, useMemo, useState, type ReactNode } from "react";
import {
	ScrollView,
	StyleSheet,
	View,
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
} from "react-native";
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
import { FORM_COLORS } from "@coding-cowboys/scorebrawl-core/presentation";

type Summary = RouterOutput["season"]["getSummary"];
type PlayerRef = Summary["champions"][number];
type Standing = Summary["podium"][number];
type SymbolName = Parameters<typeof SymbolView>[0]["name"];
type Theme = ReturnType<typeof useTheme>;
type Point = [number, number];

interface SeasonInfo {
	name: string;
	startDate: Date;
	endDate: Date | null;
}

interface PodiumEntry {
	id: string;
	rank: number;
	name: string;
	score: number;
	image: string | null;
	players: { id: string; name: string; image: string | null }[];
}

interface Card {
	key: string;
	content: ReactNode;
}

interface Column {
	key: string;
	width: "wide" | "narrow";
	cards: Card[];
}

const GUTTER = Spacing.three + 4;
const GAP = Spacing.two + 4;
const COLUMN_HEIGHT = 452;
const DAY_MS = 24 * 60 * 60 * 1000;

const COLUMN_WIDTH: Record<Column["width"], { ratio: number; max: number }> = {
	wide: { ratio: 0.88, max: 380 },
	narrow: { ratio: 0.7, max: 270 },
};

const STEP_HEIGHT: Record<number, number> = { 1: 72, 2: 56, 3: 46 };

const medalColor = (theme: Theme, rank: number) =>
	rank === 1 ? theme.glowAmberSolid : rank === 2 ? theme.mutedForeground : theme.avatar6Text;

const names = (players: PlayerRef[]) => players.map((p) => p.name).join(" & ");

const record = ({ winCount, drawCount, lossCount }: Standing) =>
	drawCount > 0 ? `${winCount}-${drawCount}-${lossCount}` : `${winCount}-${lossCount}`;

function Gradient({
	from,
	to,
	stops,
}: {
	from: Point;
	to: Point;
	stops: { color: string; opacity: number; offset: number }[];
}) {
	const id = useId();
	return (
		<Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
			<Defs>
				<LinearGradient
					id={id}
					x1={String(from[0])}
					y1={String(from[1])}
					x2={String(to[0])}
					y2={String(to[1])}
				>
					{stops.map((stop) => (
						<Stop
							key={stop.offset}
							offset={String(stop.offset)}
							stopColor={stop.color}
							stopOpacity={stop.opacity}
						/>
					))}
				</LinearGradient>
			</Defs>
			<Rect width="100%" height="100%" fill={`url(#${id})`} />
		</Svg>
	);
}

function Eyebrow({ children }: { children: ReactNode }) {
	return (
		<ThemedText themeColor="mutedForeground" style={styles.eyebrow} numberOfLines={1}>
			{children}
		</ThemedText>
	);
}

function AvatarPair({
	players,
	size,
}: {
	players: { id: string; name: string; image: string | null }[];
	size: number;
}) {
	const { headers } = useUserAvatar();
	return (
		<View style={styles.avatarPair}>
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

function ChampionBanner({ summary, action }: { summary: Summary; action: ReactNode }) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const champion = summary.podium[0];
	const hasChampion = !!champion && summary.champions.length > 0;
	const isTie = summary.champions.length > 1;
	const runnerUp = champion ? summary.podium.find((p) => p.score < champion.score) : undefined;
	const margin = champion && runnerUp ? champion.score - runnerUp.score : 0;
	const story = !hasChampion
		? "No matches were played this season."
		: isTie
			? `Shared the title on ${champion.score} points.`
			: runnerUp
				? `Finished ${margin} ${margin === 1 ? "point" : "points"} clear of ${runnerUp.name}.`
				: `Took the title with ${champion.score} points.`;

	return (
		<View style={[styles.banner, { borderBottomColor: theme.border }]} testID="champion-banner">
			<Gradient
				from={[0, 0]}
				to={[1, 1]}
				stops={[
					{ color: theme.glowAmberSolid, opacity: 0.24, offset: 0 },
					{ color: theme.glowAmberSolid, opacity: 0, offset: 0.65 },
				]}
			/>
			<View style={styles.bannerRow}>
				{hasChampion ? (
					isTie ? (
						<AvatarPair players={summary.champions} size={48} />
					) : (
						<View style={[styles.championRing, { borderColor: theme.glowAmberSolid }]}>
							<Avatar
								name={champion.name}
								image={getAvatarUri(champion.image)}
								headers={headers}
								size={60}
							/>
						</View>
					)
				) : null}
				<View style={styles.flex}>
					<View
						style={[
							styles.chip,
							{ borderColor: theme.glowAmberBorder, backgroundColor: theme.glowAmberBackground },
						]}
					>
						<SymbolView
							name={{ ios: "crown.fill", android: "emoji_events", web: "emoji_events" }}
							size={11}
							tintColor={theme.glowAmberText}
						/>
						<ThemedText style={[styles.chipText, { color: theme.glowAmberText }]}>
							{isTie ? "Season co-champions" : "Season champion"}
						</ThemedText>
					</View>
					<ThemedText style={styles.championName} numberOfLines={2}>
						{hasChampion ? names(summary.champions) : "No champion crowned"}
					</ThemedText>
				</View>
			</View>

			<View style={styles.storyRow}>
				<ThemedText style={styles.story}>{story}</ThemedText>
				{hasChampion && !isTie && champion.form.length > 0 ? (
					<View style={styles.formRow}>
						{[...champion.form].reverse().map((result, i) => (
							<View
								key={`${result}-${String(i)}`}
								style={[styles.formDot, { backgroundColor: FORM_COLORS[result] }]}
							/>
						))}
					</View>
				) : null}
			</View>

			{hasChampion ? (
				<View
					style={[
						styles.statStrip,
						{ borderColor: theme.border, backgroundColor: theme.background },
					]}
				>
					{[
						{ label: "Points", value: String(champion.score) },
						{ label: "Record", value: record(champion) },
						{ label: "Win rate", value: `${champion.winRate}%` },
						{ label: "Matches", value: String(champion.matchCount) },
					].map((stat, i) => (
						<View
							key={stat.label}
							style={[styles.stat, i > 0 && [styles.statRule, { borderLeftColor: theme.border }]]}
						>
							<ThemedText style={styles.statValue} numberOfLines={1}>
								{stat.value}
							</ThemedText>
							<ThemedText themeColor="mutedForeground" style={styles.microLabel} numberOfLines={1}>
								{stat.label}
							</ThemedText>
						</View>
					))}
				</View>
			) : null}

			{action}
		</View>
	);
}

function PodiumCard({ title, entries }: { title: string; entries: PodiumEntry[] }) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const ordered = [2, 1, 3]
		.map((rank) => entries.find((e) => e.rank === rank))
		.filter((e): e is PodiumEntry => !!e);
	return (
		<>
			<Gradient
				from={[0, 0]}
				to={[0, 1]}
				stops={[
					{ color: theme.glowAmberSolid, opacity: 0, offset: 0.4 },
					{ color: theme.glowAmberSolid, opacity: 0.1, offset: 1 },
				]}
			/>
			<View style={[styles.cardBody, styles.podiumBody]}>
				<Eyebrow>{title}</Eyebrow>
				<View style={styles.podiumRow}>
					{ordered.map((entry) => {
						const color = medalColor(theme, entry.rank);
						return (
							<View key={entry.id} style={styles.podiumColumn}>
								{entry.players.length > 0 ? (
									<AvatarPair players={entry.players} size={24} />
								) : (
									<Avatar
										name={entry.name}
										image={getAvatarUri(entry.image)}
										headers={headers}
										size={entry.rank === 1 ? 32 : 26}
									/>
								)}
								<ThemedText style={styles.podiumName} numberOfLines={3}>
									{entry.name}
								</ThemedText>
								<View
									style={[
										styles.step,
										{ height: STEP_HEIGHT[entry.rank] ?? 46, borderTopColor: color },
									]}
								>
									<Gradient
										from={[0, 0]}
										to={[0, 1]}
										stops={[
											{ color, opacity: 0.4, offset: 0 },
											{ color, opacity: 0, offset: 1 },
										]}
									/>
									<ThemedText style={[styles.stepRank, { color }]}>{entry.rank}</ThemedText>
									<ThemedText style={styles.stepScore}>{entry.score}</ThemedText>
								</View>
							</View>
						);
					})}
				</View>
			</View>
		</>
	);
}

function MomentCard({
	label,
	icon,
	accent,
	glow,
	value,
	unit,
	players,
	caption,
	detail,
}: {
	label: string;
	icon: SymbolName;
	accent: string;
	glow: string;
	value: string;
	unit: string;
	players: PlayerRef[];
	caption: string;
	detail?: string;
}) {
	const theme = useTheme();
	return (
		<>
			<Gradient
				from={[1, 0]}
				to={[0, 1]}
				stops={[
					{ color: glow, opacity: 0.2, offset: 0 },
					{ color: glow, opacity: 0, offset: 0.55 },
				]}
			/>
			<View style={styles.cardBody}>
				<View style={styles.cardHeader}>
					<Eyebrow>{label}</Eyebrow>
					<SymbolView name={icon} size={15} tintColor={accent} />
				</View>
				<View style={styles.momentValueRow}>
					<ThemedText style={[styles.momentValue, { color: accent }]} numberOfLines={1}>
						{value}
					</ThemedText>
					<ThemedText themeColor="mutedForeground" style={[styles.caption, styles.flex]}>
						{unit}
					</ThemedText>
				</View>
				<View style={[styles.momentFooter, { borderTopColor: theme.border }]}>
					<AvatarPair players={players} size={24} />
					<View style={styles.flex}>
						<ThemedText style={styles.momentCaption} numberOfLines={2}>
							{caption}
						</ThemedText>
						{detail ? (
							<ThemedText
								themeColor="mutedForeground"
								style={styles.momentDetail}
								numberOfLines={3}
							>
								{detail}
							</ThemedText>
						) : null}
					</View>
				</View>
			</View>
		</>
	);
}

function NumbersCard({ summary, season }: { summary: Summary; season: SeasonInfo }) {
	const theme = useTheme();
	const stats: { label: string; value: string }[] = [
		{ label: "Matches", value: String(summary.matchCount) },
		{ label: "Players", value: String(summary.playerCount) },
	];
	const [champion, runnerUp] = summary.podium;
	if (champion && runnerUp) {
		stats.push({ label: "Title margin", value: `+${champion.score - runnerUp.score}` });
	}
	if (season.endDate) {
		const days = Math.max(
			1,
			Math.round(
				(new Date(season.endDate).getTime() - new Date(season.startDate).getTime()) / DAY_MS
			)
		);
		stats.push({ label: days === 1 ? "Day" : "Days", value: String(days) });
	}
	return (
		<>
			<Gradient
				from={[0, 0]}
				to={[1, 1]}
				stops={[
					{ color: theme.glowBlueSolid, opacity: 0, offset: 0.45 },
					{ color: theme.glowBlueSolid, opacity: 0.12, offset: 1 },
				]}
			/>
			<View style={styles.cardBody}>
				<Eyebrow>By the numbers</Eyebrow>
				<View style={styles.numbersGrid}>
					{stats.map((stat) => (
						<View key={stat.label} style={styles.numberCell}>
							<ThemedText style={styles.numberValue}>{stat.value}</ThemedText>
							<ThemedText themeColor="mutedForeground" style={styles.microLabel}>
								{stat.label}
							</ThemedText>
						</View>
					))}
				</View>
			</View>
		</>
	);
}

function buildColumns(summary: Summary, season: SeasonInfo, theme: Theme): Column[] {
	const podiums: Card[] = [
		{
			key: "podium",
			content: (
				<PodiumCard
					title="Player podium"
					entries={summary.podium.map((p) => ({ ...p, players: [] }))}
				/>
			),
		},
	];
	if (summary.teamPodium.length > 0) {
		podiums.push({
			key: "team-podium",
			content: (
				<PodiumCard
					title="Team podium"
					entries={summary.teamPodium.map((t) => ({ ...t, image: t.logo }))}
				/>
			),
		});
	}

	const { longestWinStreak, biggestUpset, biggestGain, mostMatches } = summary.highlights;
	const moments: Card[] = [];
	if (longestWinStreak) {
		moments.push({
			key: "streak",
			content: (
				<MomentCard
					label="Longest streak"
					icon={{
						ios: "flame.fill",
						android: "local_fire_department",
						web: "local_fire_department",
					}}
					accent={theme.glowRedText}
					glow={theme.glowRedSolid}
					value={String(longestWinStreak.length)}
					unit="wins in a row"
					players={[longestWinStreak.player]}
					caption={longestWinStreak.player.name}
				/>
			),
		});
	}
	if (biggestUpset) {
		moments.push({
			key: "upset",
			content: (
				<MomentCard
					label="Biggest upset"
					icon={{ ios: "bolt.fill", android: "bolt", web: "bolt" }}
					accent={theme.glowPurpleText}
					glow={theme.glowPurpleSolid}
					value={`${Math.round(biggestUpset.winnerOdds * 100)}%`}
					unit="odds to win"
					players={biggestUpset.winners}
					caption={names(biggestUpset.winners)}
					detail={`${biggestUpset.winnerScore}–${biggestUpset.loserScore} vs ${names(biggestUpset.losers)}`}
				/>
			),
		});
	}
	if (biggestGain) {
		moments.push({
			key: "gain",
			content: (
				<MomentCard
					label="Biggest swing"
					icon={{ ios: "chart.line.uptrend.xyaxis", android: "trending_up", web: "trending_up" }}
					accent={theme.glowEmeraldText}
					glow={theme.glowEmeraldSolid}
					value={`+${biggestGain.gain}`}
					unit="pts in one match"
					players={[biggestGain.player]}
					caption={biggestGain.player.name}
				/>
			),
		});
	}
	if (mostMatches) {
		moments.push({
			key: "matches",
			content: (
				<MomentCard
					label="Iron player"
					icon={{ ios: "gamecontroller.fill", android: "sports_esports", web: "sports_esports" }}
					accent={theme.glowBlueText}
					glow={theme.glowBlueSolid}
					value={String(mostMatches.matchCount)}
					unit="matches played"
					players={[mostMatches.player]}
					caption={mostMatches.player.name}
				/>
			),
		});
	}
	const numbers: Card = {
		key: "numbers",
		content: <NumbersCard summary={summary} season={season} />,
	};

	const columns: Column[] = [{ key: "podiums", width: "wide", cards: podiums }];
	for (let i = 0; i < moments.length; i += 2) {
		columns.push({ key: `moments-${i}`, width: "narrow", cards: moments.slice(i, i + 2) });
	}
	const last = columns[columns.length - 1];
	if (last.width === "narrow" && last.cards.length === 1) {
		last.cards.push(numbers);
	} else {
		columns.push({ key: "numbers", width: "narrow", cards: [numbers] });
	}
	return columns;
}

export function SeasonCeremony({
	seasonSlug,
	season,
	canStartNextSeason,
}: {
	seasonSlug: string;
	season: SeasonInfo;
	canStartNextSeason: boolean;
}) {
	const trpc = useTRPC();
	const theme = useTheme();
	const [containerWidth, setContainerWidth] = useState(0);
	const [scroll, setScroll] = useState({ visible: 1, position: 0 });
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));

	const columns = useMemo(
		() => (summary && summary.matchCount > 0 ? buildColumns(summary, season, theme) : []),
		[summary, season, theme]
	);
	const widths = columns.map(({ width }) =>
		Math.min(Math.round(containerWidth * COLUMN_WIDTH[width].ratio), COLUMN_WIDTH[width].max)
	);
	const offsets = widths.reduce<number[]>(
		(acc, _, i) => [...acc, i === 0 ? 0 : acc[i - 1] + widths[i - 1] + GAP],
		[]
	);

	const onLayout = (event: LayoutChangeEvent) => setContainerWidth(event.nativeEvent.layout.width);

	const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
		const overflow = contentSize.width - layoutMeasurement.width;
		setScroll({
			visible: Math.min(1, layoutMeasurement.width / contentSize.width),
			position: overflow > 0 ? Math.min(1, Math.max(0, contentOffset.x / overflow)) : 0,
		});
	};

	if (!summary) return <Skeleton width="100%" height={640} />;

	const cardFrame = { backgroundColor: theme.background, borderColor: theme.border };

	return (
		<View
			style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}
			onLayout={onLayout}
			testID="season-ceremony"
		>
			<ChampionBanner
				summary={summary}
				action={
					canStartNextSeason ? (
						<Button
							variant="glow"
							size="sm"
							icon={{ ios: "plus", android: "add", web: "add" }}
							onPress={() => setIsCreateOpen(true)}
							style={styles.cta}
						>
							Start next season
						</Button>
					) : null
				}
			/>

			{columns.length > 0 && containerWidth > 0 ? (
				<>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						snapToOffsets={offsets}
						decelerationRate="fast"
						onScroll={onScroll}
						onContentSizeChange={(width) =>
							setScroll((prev) => ({ ...prev, visible: Math.min(1, containerWidth / width) }))
						}
						scrollEventThrottle={32}
						contentContainerStyle={styles.track}
					>
						{columns.map((column, index) => (
							<View key={column.key} style={[styles.column, { width: widths[index] }]}>
								{column.cards.map((card) => (
									<View key={card.key} style={[styles.card, cardFrame]}>
										{card.content}
									</View>
								))}
							</View>
						))}
					</ScrollView>
					<View style={styles.progressWrap}>
						<View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
							{scroll.visible < 0.999 ? (
								<View
									style={[
										styles.progressThumb,
										{
											backgroundColor: theme.glowAmberSolid,
											width: `${scroll.visible * 100}%`,
											left: `${scroll.position * (1 - scroll.visible) * 100}%`,
										},
									]}
								/>
							) : null}
						</View>
					</View>
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
	flex: {
		flex: 1,
		minWidth: 0,
	},
	section: {
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	banner: {
		paddingHorizontal: GUTTER,
		paddingVertical: Spacing.four,
		gap: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	bannerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
	},
	championRing: {
		borderWidth: 2,
		borderRadius: 10,
		padding: 2,
	},
	chip: {
		alignSelf: "flex-start",
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 10,
		paddingVertical: 3,
		borderRadius: 999,
		borderWidth: 1,
		marginBottom: 6,
	},
	chipText: {
		fontSize: 10,
		lineHeight: 13,
		fontWeight: "700",
		letterSpacing: 1.6,
		textTransform: "uppercase",
	},
	championName: {
		fontSize: 26,
		lineHeight: 30,
		fontWeight: "900",
		letterSpacing: -0.5,
	},
	storyRow: {
		gap: Spacing.two,
	},
	story: {
		fontSize: 13,
		lineHeight: 19,
		opacity: 0.85,
	},
	formRow: {
		flexDirection: "row",
		gap: 4,
	},
	formDot: {
		width: 7,
		height: 7,
		borderRadius: 4,
	},
	statStrip: {
		flexDirection: "row",
		borderWidth: StyleSheet.hairlineWidth,
		paddingVertical: Spacing.two + 2,
	},
	stat: {
		flex: 1,
		alignItems: "center",
		gap: 3,
		paddingHorizontal: 2,
	},
	statRule: {
		borderLeftWidth: StyleSheet.hairlineWidth,
	},
	statValue: {
		fontSize: 15,
		lineHeight: 19,
		fontWeight: "800",
		fontVariant: ["tabular-nums"],
	},
	cta: {
		alignSelf: "flex-start",
	},
	eyebrow: {
		fontSize: 10,
		lineHeight: 14,
		fontWeight: "700",
		letterSpacing: 2,
		textTransform: "uppercase",
	},
	microLabel: {
		fontSize: 9,
		lineHeight: 12,
		letterSpacing: 1.4,
		textTransform: "uppercase",
	},
	caption: {
		fontSize: 12,
		lineHeight: 16,
	},
	track: {
		paddingHorizontal: GUTTER,
		paddingTop: Spacing.three + 4,
		gap: GAP,
	},
	column: {
		height: COLUMN_HEIGHT,
		gap: GAP,
	},
	card: {
		flex: 1,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	cardBody: {
		flex: 1,
		padding: Spacing.three,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	avatarPair: {
		flexDirection: "row",
		gap: 4,
	},
	podiumBody: {
		paddingHorizontal: Spacing.two + 4,
	},
	podiumRow: {
		marginTop: "auto",
		flexDirection: "row",
		alignItems: "flex-end",
		gap: 4,
	},
	podiumColumn: {
		flex: 1,
		minWidth: 0,
		alignItems: "center",
		gap: 5,
	},
	podiumName: {
		fontSize: 10,
		lineHeight: 13,
		fontWeight: "700",
		textAlign: "center",
		minHeight: 28,
	},
	step: {
		width: "100%",
		alignItems: "center",
		paddingTop: 5,
		borderTopWidth: 2,
		overflow: "hidden",
	},
	stepRank: {
		fontSize: 20,
		lineHeight: 24,
		fontWeight: "900",
	},
	stepScore: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: "700",
		fontVariant: ["tabular-nums"],
	},
	momentValueRow: {
		marginTop: Spacing.two + 4,
		flexDirection: "row",
		alignItems: "baseline",
		gap: Spacing.two,
	},
	momentValue: {
		fontSize: 44,
		lineHeight: 50,
		fontWeight: "900",
		letterSpacing: -2,
		fontVariant: ["tabular-nums"],
	},
	momentFooter: {
		marginTop: "auto",
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two + 2,
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingTop: Spacing.two + 4,
	},
	momentCaption: {
		fontSize: 12,
		lineHeight: 16,
		fontWeight: "700",
	},
	momentDetail: {
		fontSize: 11,
		lineHeight: 15,
	},
	numbersGrid: {
		marginTop: "auto",
		flexDirection: "row",
		flexWrap: "wrap",
		rowGap: Spacing.three + 4,
	},
	numberCell: {
		width: "50%",
		gap: 4,
	},
	numberValue: {
		fontSize: 28,
		lineHeight: 32,
		fontWeight: "900",
		fontVariant: ["tabular-nums"],
	},
	progressWrap: {
		paddingHorizontal: GUTTER,
		paddingTop: Spacing.three,
		paddingBottom: Spacing.four,
	},
	progressTrack: {
		height: 3,
	},
	progressThumb: {
		position: "absolute",
		top: 0,
		bottom: 0,
	},
});
