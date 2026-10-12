import { useQuery } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import {
	ScrollView,
	StyleSheet,
	View,
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
} from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Spacing } from "@/constants/theme";
import { getAvatarUri, useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

type SymbolName = Parameters<typeof SymbolView>[0]["name"];
type FormResult = "W" | "D" | "L";

const FORM_COLORS: Record<FormResult, string> = {
	W: "#16a34a",
	D: "#d97706",
	L: "#dc2626",
};

function DashboardCard({
	title,
	icon,
	accent,
	children,
}: {
	title: string;
	icon: SymbolName;
	accent: string;
	children: ReactNode;
}) {
	const theme = useTheme();
	return (
		<View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
			<View style={[styles.glow, { backgroundColor: `${accent}0d` }]} />
			<View style={styles.cardHeader}>
				<ThemedText type="smallBold">{title}</ThemedText>
				<SymbolView name={icon} size={16} tintColor={accent} />
			</View>
			{children}
		</View>
	);
}

function FormDots({ form }: { form: FormResult[] }) {
	return (
		<View style={styles.formDots}>
			{form.map((result, i) => (
				<View
					key={`${result}-${String(i)}`}
					style={[styles.formDot, { backgroundColor: FORM_COLORS[result] }]}
				/>
			))}
		</View>
	);
}

function PlayerStat({
	player,
	loading,
	empty,
}: {
	player:
		| { name: string; image: string | null; score: number; form?: FormResult[] }
		| null
		| undefined;
	loading: boolean;
	empty: string;
}) {
	const { headers } = useUserAvatar();
	if (loading) return <Skeleton width="100%" height={40} />;
	if (!player) {
		return (
			<ThemedText type="small" themeColor="textSecondary">
				{empty}
			</ThemedText>
		);
	}
	return (
		<View style={styles.playerRow}>
			<Avatar name={player.name} image={getAvatarUri(player.image)} headers={headers} size={36} />
			<View style={styles.playerInfo}>
				<ThemedText type="smallBold" numberOfLines={1}>
					{player.name}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
					{player.score} points
				</ThemedText>
			</View>
			{player.form && player.form.length > 0 ? <FormDots form={player.form} /> : null}
		</View>
	);
}

function OnFireCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data, isPending } = useQuery(trpc.seasonPlayer.getTop.queryOptions({ seasonSlug }));
	return (
		<DashboardCard
			title="On Fire"
			icon={{ ios: "flame.fill", android: "local_fire_department", web: "local_fire_department" }}
			accent="#ef4444"
		>
			<PlayerStat player={data} loading={isPending} empty="No matches yet" />
		</DashboardCard>
	);
}

function StrugglingCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: standings, isPending } = useQuery(
		trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug })
	);
	const player =
		[...(standings ?? [])].filter((p) => p.matchCount >= 3).sort((a, b) => a.score - b.score)[0] ??
		null;
	return (
		<DashboardCard
			title="Struggling"
			icon={{ ios: "snowflake", android: "ac_unit", web: "ac_unit" }}
			accent="#3b82f6"
		>
			<PlayerStat player={player} loading={isPending} empty="No players with 3+ matches" />
		</DashboardCard>
	);
}

function InfoCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data, isPending } = useQuery(trpc.season.getCountInfo.queryOptions({ seasonSlug }));
	return (
		<DashboardCard
			title="General Info"
			icon={{ ios: "chart.bar.fill", android: "bar_chart", web: "bar_chart" }}
			accent="#10b981"
		>
			{isPending ? (
				<Skeleton width="100%" height={40} />
			) : (
				<View style={styles.infoGrid}>
					{[
						{ value: data?.matchCount ?? 0, label: "Matches" },
						{ value: data?.playerCount ?? 0, label: "Players" },
						{ value: data?.teamCount ?? 0, label: "Teams" },
					].map(({ value, label }) => (
						<View key={label} style={styles.infoCell}>
							<ThemedText style={styles.infoValue}>{value}</ThemedText>
							<ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
								{label}
							</ThemedText>
						</View>
					))}
				</View>
			)}
		</DashboardCard>
	);
}

interface LatestPlayer {
	id: string;
	homeTeam: boolean;
	name: string;
	image: string | null;
	teamName: string | null;
	teamLogo: string | null;
}

function sideLabel(players: LatestPlayer[]) {
	if (players.length === 0) return "Unknown";
	if (players.length === 1) return players[0].name;
	return players[0].teamName ?? players.map((p) => p.name.split(" ")[0]).join(" & ");
}

function MatchSide({
	players,
	score,
	isWinner,
	isLoser,
}: {
	players: LatestPlayer[];
	score: number;
	isWinner: boolean;
	isLoser: boolean;
}) {
	const theme = useTheme();
	const { headers } = useUserAvatar();
	const label = sideLabel(players);
	const avatar =
		players.length > 1
			? { name: label, image: getAvatarUri(players[0]?.teamLogo) }
			: { name: players[0]?.name ?? "?", image: getAvatarUri(players[0]?.image) };
	return (
		<View style={styles.sideRow}>
			<Avatar name={avatar.name} image={avatar.image} headers={headers} size={24} />
			<ThemedText
				type={isWinner ? "smallBold" : "small"}
				themeColor={isLoser ? "textSecondary" : "text"}
				numberOfLines={1}
				style={styles.sideLabel}
			>
				{label}
			</ThemedText>
			<View
				style={[
					styles.scoreBadge,
					{ backgroundColor: `${theme.primary}1a`, borderColor: theme.border },
				]}
			>
				<ThemedText
					type={isWinner ? "smallBold" : "small"}
					themeColor={isLoser ? "textSecondary" : "text"}
				>
					{score}
				</ThemedText>
			</View>
		</View>
	);
}

function LatestMatchCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: match, isPending } = useQuery(trpc.match.getLatest.queryOptions({ seasonSlug }));
	const players = (match?.players ?? []) as LatestPlayer[];
	const home = players.filter((p) => p.homeTeam);
	const away = players.filter((p) => !p.homeTeam);
	const homeScore = match?.homeScore ?? 0;
	const awayScore = match?.awayScore ?? 0;

	return (
		<DashboardCard
			title="Latest Match"
			icon={{ ios: "trophy", android: "emoji_events", web: "emoji_events" }}
			accent="#f59e0b"
		>
			{isPending ? (
				<Skeleton width="100%" height={56} />
			) : match ? (
				<View style={styles.sides}>
					<MatchSide
						players={home}
						score={homeScore}
						isWinner={homeScore > awayScore}
						isLoser={awayScore > homeScore}
					/>
					<MatchSide
						players={away}
						score={awayScore}
						isWinner={awayScore > homeScore}
						isLoser={homeScore > awayScore}
					/>
				</View>
			) : (
				<ThemedText type="small" themeColor="textSecondary">
					No matches yet
				</ThemedText>
			)}
		</DashboardCard>
	);
}

export function DashboardCards({ seasonSlug }: { seasonSlug: string }) {
	const theme = useTheme();
	const [width, setWidth] = useState(0);
	const [active, setActive] = useState(0);
	const cards = [
		<LatestMatchCard key="latest" seasonSlug={seasonSlug} />,
		<OnFireCard key="fire" seasonSlug={seasonSlug} />,
		<StrugglingCard key="struggling" seasonSlug={seasonSlug} />,
		<InfoCard key="info" seasonSlug={seasonSlug} />,
	];

	const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		if (width === 0) return;
		setActive(Math.round(e.nativeEvent.contentOffset.x / width));
	};

	return (
		<View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
			<ScrollView
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onScroll={onScroll}
				scrollEventThrottle={32}
			>
				{cards.map((card) => (
					<View key={card.key} style={{ width }}>
						{card}
					</View>
				))}
			</ScrollView>
			<View style={styles.dots}>
				{cards.map((card, i) => (
					<View
						key={card.key}
						style={[
							styles.dot,
							i === active
								? { width: 16, backgroundColor: theme.text }
								: { backgroundColor: `${theme.textSecondary}55` },
						]}
					/>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: StyleSheet.hairlineWidth,
		padding: Spacing.three,
		gap: Spacing.three,
		minHeight: 120,
		overflow: "hidden",
	},
	glow: {
		position: "absolute",
		top: -60,
		right: -60,
		width: 180,
		height: 180,
		borderRadius: 90,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	playerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	playerInfo: {
		flex: 1,
	},
	caption: {
		fontSize: 12,
		lineHeight: 16,
	},
	formDots: {
		flexDirection: "row",
		gap: 3,
	},
	formDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	infoGrid: {
		flexDirection: "row",
	},
	infoCell: {
		flex: 1,
		alignItems: "center",
	},
	infoValue: {
		fontSize: 18,
		fontWeight: "700",
	},
	sides: {
		gap: Spacing.two,
	},
	sideRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	sideLabel: {
		flex: 1,
		fontSize: 13,
	},
	scoreBadge: {
		minWidth: 26,
		height: 26,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
	},
	dots: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 6,
		marginTop: Spacing.two,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
});
