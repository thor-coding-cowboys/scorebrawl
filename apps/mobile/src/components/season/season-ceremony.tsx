import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Avatar } from "@/components/avatar";
import { CreateSeasonForm } from "@/components/create-season-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Skeleton } from "@/components/ui/skeleton";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getAvatarUri, useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC, type RouterOutput } from "@/lib/trpc";
import { formatDate } from "@coding-cowboys/scorebrawl-core/league";
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

type SlideWidth = "wide" | "medium" | "narrow";

interface Slide {
	key: string;
	width: SlideWidth;
	content: ReactNode;
}

const SLIDE_GAP = Spacing.three;
const SLIDE_HEIGHT = 340;
const GUTTER = Spacing.three + 4;
const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_WIDTH: Record<SlideWidth, { ratio: number; max: number }> = {
	wide: { ratio: 0.86, max: 440 },
	medium: { ratio: 0.86, max: 330 },
	narrow: { ratio: 0.78, max: 280 },
};

const STEP_HEIGHT: Record<number, number> = { 1: 112, 2: 80, 3: 58 };

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

function ChampionSlide({ summary }: { summary: Summary }) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const champion = summary.podium[0];
	const isTie = summary.champions.length > 1;

	if (!champion || summary.champions.length === 0) {
		return (
			<View style={styles.centered}>
				<Eyebrow>Champion</Eyebrow>
				<ThemedText style={styles.championName}>No champion crowned</ThemedText>
				<ThemedText themeColor="mutedForeground" style={styles.caption}>
					No matches were played this season.
				</ThemedText>
			</View>
		);
	}

	const runnerUp = summary.podium.find((p) => p.score < champion.score);
	const margin = runnerUp ? champion.score - runnerUp.score : 0;
	const story = isTie
		? `Shared the title on ${champion.score} points.`
		: runnerUp
			? `Finished ${margin} ${margin === 1 ? "point" : "points"} clear of ${runnerUp.name}.`
			: `Took the title with ${champion.score} points.`;

	return (
		<>
			<Gradient
				from={[1, 0]}
				to={[0, 1]}
				stops={[
					{ color: theme.glowAmberSolid, opacity: 0.28, offset: 0 },
					{ color: theme.glowAmberSolid, opacity: 0, offset: 0.6 },
				]}
			/>
			<View style={styles.slideBody}>
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
						{isTie ? "Co-champions" : "Champion"}
					</ThemedText>
				</View>

				<View style={styles.championRow}>
					{isTie ? (
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
					)}
					<View style={styles.flex}>
						<ThemedText style={styles.championName} numberOfLines={2}>
							{names(summary.champions)}
						</ThemedText>
						{!isTie && champion.form.length > 0 ? (
							<View style={styles.formRow}>
								<ThemedText themeColor="mutedForeground" style={styles.microLabel}>
									Form
								</ThemedText>
								{[...champion.form].reverse().map((result, i) => (
									<View
										key={`${result}-${String(i)}`}
										style={[styles.formDot, { backgroundColor: FORM_COLORS[result] }]}
									/>
								))}
							</View>
						) : null}
					</View>
				</View>

				<ThemedText style={styles.story}>{story}</ThemedText>

				<View
					style={[styles.statStrip, { borderColor: theme.border, backgroundColor: theme.muted }]}
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
			</View>
		</>
	);
}

function PodiumSlide({ title, entries }: { title: string; entries: PodiumEntry[] }) {
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
					{ color: theme.glowAmberSolid, opacity: 0.12, offset: 1 },
				]}
			/>
			<View style={styles.slideBody}>
				<Eyebrow>{title}</Eyebrow>
				<View style={styles.podiumRow}>
					{ordered.map((entry) => {
						const color = medalColor(theme, entry.rank);
						const isWinner = entry.rank === 1;
						return (
							<View key={entry.id} style={styles.podiumColumn}>
								{entry.players.length > 0 ? (
									<AvatarPair players={entry.players} size={isWinner ? 30 : 26} />
								) : (
									<Avatar
										name={entry.name}
										image={getAvatarUri(entry.image)}
										headers={headers}
										size={isWinner ? 44 : 34}
									/>
								)}
								<ThemedText style={styles.podiumName} numberOfLines={2}>
									{entry.name}
								</ThemedText>
								<View
									style={[
										styles.step,
										{ height: STEP_HEIGHT[entry.rank] ?? 58, borderTopColor: color },
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

function MomentSlide({
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
					{ color: glow, opacity: 0.22, offset: 0 },
					{ color: glow, opacity: 0, offset: 0.55 },
				]}
			/>
			<View style={styles.slideBody}>
				<View style={styles.slideHeader}>
					<Eyebrow>{label}</Eyebrow>
					<SymbolView name={icon} size={16} tintColor={accent} />
				</View>
				<View style={styles.momentValueBlock}>
					<ThemedText style={[styles.momentValue, { color: accent }]} numberOfLines={1}>
						{value}
					</ThemedText>
					<ThemedText themeColor="mutedForeground" style={styles.caption}>
						{unit}
					</ThemedText>
				</View>
				<View style={[styles.momentFooter, { borderTopColor: theme.border }]}>
					<AvatarPair players={players} size={26} />
					<View style={styles.flex}>
						<ThemedText style={styles.momentCaption} numberOfLines={2}>
							{caption}
						</ThemedText>
						{detail ? (
							<ThemedText
								themeColor="mutedForeground"
								style={styles.momentDetail}
								numberOfLines={2}
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

function NumbersSlide({ summary, season }: { summary: Summary; season: SeasonInfo }) {
	const theme = useTheme();
	const [champion, runnerUp] = summary.podium;
	const rows: { label: string; value: string }[] = [
		{ label: "Matches played", value: String(summary.matchCount) },
		{ label: "Players", value: String(summary.playerCount) },
	];
	if (champion && runnerUp) {
		rows.push({ label: "Title decided by", value: `${champion.score - runnerUp.score} pts` });
	}
	if (season.endDate) {
		const days = Math.max(
			1,
			Math.round(
				(new Date(season.endDate).getTime() - new Date(season.startDate).getTime()) / DAY_MS
			)
		);
		rows.push({ label: "Season length", value: `${days} ${days === 1 ? "day" : "days"}` });
	}
	return (
		<>
			<Gradient
				from={[0, 0]}
				to={[1, 1]}
				stops={[
					{ color: theme.glowBlueSolid, opacity: 0, offset: 0.45 },
					{ color: theme.glowBlueSolid, opacity: 0.14, offset: 1 },
				]}
			/>
			<View style={styles.slideBody}>
				<Eyebrow>By the numbers</Eyebrow>
				<View style={styles.numbers}>
					{rows.map((row, i) => (
						<View
							key={row.label}
							style={[
								styles.numberRow,
								i > 0 && [styles.numberRule, { borderTopColor: theme.border }],
							]}
						>
							<ThemedText themeColor="mutedForeground" style={styles.caption}>
								{row.label}
							</ThemedText>
							<ThemedText style={styles.numberValue}>{row.value}</ThemedText>
						</View>
					))}
				</View>
			</View>
		</>
	);
}

function buildSlides(summary: Summary, season: SeasonInfo, theme: Theme): Slide[] {
	const slides: Slide[] = [
		{ key: "champion", width: "wide", content: <ChampionSlide summary={summary} /> },
	];
	if (summary.matchCount === 0) return slides;

	slides.push({
		key: "podium",
		width: "medium",
		content: (
			<PodiumSlide
				title="Player podium"
				entries={summary.podium.map((p) => ({ ...p, players: [] }))}
			/>
		),
	});
	if (summary.teamPodium.length > 0) {
		slides.push({
			key: "team-podium",
			width: "medium",
			content: (
				<PodiumSlide
					title="Team podium"
					entries={summary.teamPodium.map((t) => ({ ...t, image: t.logo }))}
				/>
			),
		});
	}

	const { longestWinStreak, biggestUpset, biggestGain, mostMatches } = summary.highlights;
	if (longestWinStreak) {
		slides.push({
			key: "streak",
			width: "narrow",
			content: (
				<MomentSlide
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
		slides.push({
			key: "upset",
			width: "narrow",
			content: (
				<MomentSlide
					label="Biggest upset"
					icon={{ ios: "bolt.fill", android: "bolt", web: "bolt" }}
					accent={theme.glowPurpleText}
					glow={theme.glowPurpleSolid}
					value={`${Math.round(biggestUpset.winnerOdds * 100)}%`}
					unit="chance to win — and they did"
					players={biggestUpset.winners}
					caption={names(biggestUpset.winners)}
					detail={`${biggestUpset.winnerScore}–${biggestUpset.loserScore} vs ${names(biggestUpset.losers)}`}
				/>
			),
		});
	}
	if (biggestGain) {
		slides.push({
			key: "gain",
			width: "narrow",
			content: (
				<MomentSlide
					label="Biggest swing"
					icon={{ ios: "chart.line.uptrend.xyaxis", android: "trending_up", web: "trending_up" }}
					accent={theme.glowEmeraldText}
					glow={theme.glowEmeraldSolid}
					value={`+${biggestGain.gain}`}
					unit="points in a single match"
					players={[biggestGain.player]}
					caption={biggestGain.player.name}
				/>
			),
		});
	}
	if (mostMatches) {
		slides.push({
			key: "matches",
			width: "narrow",
			content: (
				<MomentSlide
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
	slides.push({
		key: "numbers",
		width: "narrow",
		content: <NumbersSlide summary={summary} season={season} />,
	});
	return slides;
}

function Backdrop() {
	const theme = useTheme();
	return (
		<>
			<Gradient
				from={[0, 0]}
				to={[1, 1]}
				stops={[
					{ color: theme.glowAmberSolid, opacity: 0.2, offset: 0 },
					{ color: theme.glowAmberSolid, opacity: 0, offset: 0.45 },
				]}
			/>
			<Gradient
				from={[1, 1]}
				to={[0, 0]}
				stops={[
					{ color: theme.glowPinkSolid, opacity: 0.12, offset: 0 },
					{ color: theme.glowPinkSolid, opacity: 0, offset: 0.5 },
				]}
			/>
		</>
	);
}

function RecapHeader({
	season,
	summary,
	actions,
}: {
	season: SeasonInfo;
	summary: Summary;
	actions: ReactNode;
}) {
	const theme = useTheme();
	const dateRange = `${formatDate(season.startDate)}${season.endDate ? ` – ${formatDate(season.endDate)}` : ""}`;
	return (
		<View style={styles.header}>
			<View style={styles.recapLabel}>
				<View style={[styles.recapDot, { backgroundColor: theme.glowAmberSolid }]} />
				<Eyebrow color={theme.glowAmberText}>Season recap</Eyebrow>
			</View>
			<ThemedText style={styles.seasonName} numberOfLines={2}>
				{season.name}
			</ThemedText>
			<ThemedText themeColor="mutedForeground" style={styles.caption}>
				{dateRange} · {summary.matchCount} matches · {summary.playerCount} players
			</ThemedText>
			<View style={styles.actions}>{actions}</View>
		</View>
	);
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
	const insets = useSafeAreaInsets();
	const scrollRef = useRef<ScrollView>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	const [active, setActive] = useState(0);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isFullScreen, setIsFullScreen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));

	const slides = useMemo(
		() => (summary ? buildSlides(summary, season, theme) : []),
		[summary, season, theme]
	);
	const widths = slides.map(({ width }) =>
		Math.min(Math.round(containerWidth * MAX_WIDTH[width].ratio), MAX_WIDTH[width].max)
	);
	const offsets = widths.reduce<number[]>(
		(acc, _, i) => [...acc, i === 0 ? 0 : acc[i - 1] + widths[i - 1] + SLIDE_GAP],
		[]
	);

	const onLayout = (event: LayoutChangeEvent) => setContainerWidth(event.nativeEvent.layout.width);

	const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
		if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 4) {
			setActive(slides.length - 1);
			return;
		}
		const distances = offsets.map((offset) => Math.abs(offset - contentOffset.x));
		setActive(distances.indexOf(Math.min(...distances)));
	};

	const goTo = (index: number) =>
		scrollRef.current?.scrollTo({ x: offsets[index] ?? 0, animated: true });

	if (!summary) return <Skeleton width="100%" height={520} />;

	const startNextSeason = canStartNextSeason ? (
		<Button
			variant="glow"
			size="sm"
			icon={{ ios: "plus", android: "add", web: "add" }}
			onPress={() => {
				setIsFullScreen(false);
				setIsCreateOpen(true);
			}}
		>
			Start next season
		</Button>
	) : null;

	const slideFrame = { backgroundColor: theme.background, borderColor: theme.border };

	return (
		<>
			<View
				style={[styles.hero, { backgroundColor: theme.card, borderColor: theme.border }]}
				onLayout={onLayout}
				testID="season-ceremony"
			>
				<Backdrop />
				<RecapHeader
					season={season}
					summary={summary}
					actions={
						<>
							{startNextSeason}
							<Button
								variant="outline"
								size="sm"
								icon={{
									ios: "arrow.up.left.and.arrow.down.right",
									android: "fullscreen",
									web: "fullscreen",
								}}
								onPress={() => setIsFullScreen(true)}
								testID="recap-full-screen-button"
							>
								Full screen
							</Button>
						</>
					}
				/>

				{containerWidth > 0 ? (
					<ScrollView
						ref={scrollRef}
						horizontal
						showsHorizontalScrollIndicator={false}
						snapToOffsets={offsets}
						decelerationRate="fast"
						disableIntervalMomentum
						onScroll={onScroll}
						scrollEventThrottle={32}
						contentContainerStyle={styles.track}
					>
						{slides.map((slide, index) => (
							<View
								key={slide.key}
								style={[styles.slide, slideFrame, { width: widths[index] }]}
								accessibilityLabel={`${index + 1} of ${slides.length}`}
							>
								{slide.content}
							</View>
						))}
					</ScrollView>
				) : (
					<View style={{ height: SLIDE_HEIGHT }} />
				)}

				<View style={styles.progress}>
					{slides.map((slide, index) => (
						<Pressable
							key={slide.key}
							accessibilityRole="button"
							accessibilityLabel={`Go to slide ${index + 1}`}
							onPress={() => goTo(index)}
							hitSlop={8}
							style={styles.progressHit}
						>
							<View
								style={[
									styles.progressBar,
									{
										backgroundColor:
											index === active
												? theme.glowAmberSolid
												: index < active
													? theme.mutedForeground
													: theme.border,
									},
								]}
							/>
						</Pressable>
					))}
				</View>
			</View>

			<Modal
				visible={isFullScreen}
				animationType="slide"
				onRequestClose={() => setIsFullScreen(false)}
			>
				<ThemedView style={styles.fullScreen} testID="season-recap-full-screen">
					<Backdrop />
					<ScrollView
						contentContainerStyle={[
							styles.fullScreenContent,
							{
								paddingTop: insets.top + Spacing.three,
								paddingBottom: insets.bottom + Spacing.five,
							},
						]}
					>
						<View style={styles.fullScreenClose}>
							<ModalCloseButton onPress={() => setIsFullScreen(false)} />
						</View>
						<RecapHeader season={season} summary={summary} actions={startNextSeason} />
						<View style={styles.fullScreenSlides}>
							{slides.map((slide) => (
								<View key={slide.key} style={[styles.slide, slideFrame]}>
									{slide.content}
								</View>
							))}
						</View>
					</ScrollView>
				</ThemedView>
			</Modal>

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
		</>
	);
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
		minWidth: 0,
	},
	hero: {
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	header: {
		paddingHorizontal: GUTTER,
		paddingTop: Spacing.four,
		gap: Spacing.two,
	},
	recapLabel: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	recapDot: {
		width: 7,
		height: 7,
		borderRadius: 4,
	},
	seasonName: {
		fontSize: 34,
		lineHeight: 38,
		fontWeight: "900",
		letterSpacing: -1,
	},
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.two,
		marginTop: Spacing.one,
	},
	track: {
		paddingHorizontal: GUTTER,
		paddingTop: Spacing.three,
		gap: SLIDE_GAP,
	},
	slide: {
		height: SLIDE_HEIGHT,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	slideBody: {
		flex: 1,
		padding: Spacing.three + 4,
	},
	slideHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	centered: {
		flex: 1,
		justifyContent: "center",
		gap: Spacing.two,
		padding: Spacing.three + 4,
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
		letterSpacing: 1.5,
		textTransform: "uppercase",
	},
	caption: {
		fontSize: 12,
		lineHeight: 17,
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
	},
	chipText: {
		fontSize: 10,
		lineHeight: 13,
		fontWeight: "700",
		letterSpacing: 1.8,
		textTransform: "uppercase",
	},
	championRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		marginTop: Spacing.three,
	},
	championRing: {
		borderWidth: 2,
		borderRadius: 10,
		padding: 2,
	},
	championName: {
		fontSize: 24,
		lineHeight: 27,
		fontWeight: "900",
		letterSpacing: -0.5,
	},
	formRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginTop: 6,
	},
	formDot: {
		width: 7,
		height: 7,
		borderRadius: 4,
	},
	story: {
		fontSize: 13,
		lineHeight: 19,
		marginTop: Spacing.three,
		opacity: 0.85,
	},
	statStrip: {
		marginTop: "auto",
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
	avatarPair: {
		flexDirection: "row",
		gap: 4,
	},
	podiumRow: {
		marginTop: "auto",
		flexDirection: "row",
		alignItems: "flex-end",
		gap: Spacing.two,
	},
	podiumColumn: {
		flex: 1,
		minWidth: 0,
		alignItems: "center",
		gap: 6,
	},
	podiumName: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: "700",
		textAlign: "center",
		minHeight: 28,
	},
	step: {
		width: "100%",
		alignItems: "center",
		paddingTop: 6,
		borderTopWidth: 2,
		overflow: "hidden",
	},
	stepRank: {
		fontSize: 24,
		lineHeight: 28,
		fontWeight: "900",
	},
	stepScore: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: "700",
		fontVariant: ["tabular-nums"],
	},
	momentValueBlock: {
		marginTop: Spacing.four,
		gap: 4,
	},
	momentValue: {
		fontSize: 64,
		lineHeight: 70,
		fontWeight: "900",
		letterSpacing: -3,
		fontVariant: ["tabular-nums"],
	},
	momentFooter: {
		marginTop: "auto",
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two + 2,
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingTop: Spacing.three,
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
	numbers: {
		marginTop: "auto",
	},
	numberRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: Spacing.two,
		paddingVertical: Spacing.two + 2,
	},
	numberRule: {
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	numberValue: {
		fontSize: 22,
		lineHeight: 26,
		fontWeight: "900",
		fontVariant: ["tabular-nums"],
	},
	progress: {
		flexDirection: "row",
		gap: 6,
		paddingHorizontal: GUTTER,
		paddingTop: Spacing.three,
		paddingBottom: Spacing.four,
	},
	progressHit: {
		flex: 1,
		paddingVertical: 6,
	},
	progressBar: {
		height: 3,
	},
	fullScreen: {
		flex: 1,
	},
	fullScreenContent: {
		width: "100%",
		maxWidth: MaxContentWidth,
		alignSelf: "center",
	},
	fullScreenClose: {
		alignItems: "flex-end",
		paddingHorizontal: GUTTER,
	},
	fullScreenSlides: {
		paddingHorizontal: GUTTER,
		paddingTop: Spacing.four,
		gap: Spacing.three,
	},
});
