import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { SkeletonMatchRow } from "@/components/ui/skeleton-rows";
import { StaticList } from "@/components/ui/static-list";
import { Spacing, SharedColors } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { authClient, getAuthCookie } from "@/lib/auth-client";
import { trpcClient, useTRPC } from "@/lib/trpc";
import {
	getSideLabel,
	getTeamInfo,
	type MatchDisplayPlayer,
} from "@coding-cowboys/scorebrawl-core/presentation";

interface MatchPlayer {
	id: string;
	seasonPlayerId: string;
	result: "W" | "D" | "L";
	scoreBefore: number;
	scoreAfter: number;
	name: string;
	image: string | null;
}

interface MatchTeam {
	name: string | null;
	logo: string | null;
	players: MatchPlayer[];
}

function formatTimestamp(date: Date) {
	const now = new Date();
	const matchDate = new Date(date);
	const isToday = now.toDateString() === matchDate.toDateString();

	if (isToday) {
		const diffMinutes = Math.floor((now.getTime() - matchDate.getTime()) / (1000 * 60));
		if (diffMinutes < 60) {
			return { primary: diffMinutes <= 1 ? "1m ago" : `${diffMinutes}m ago`, secondary: null };
		}
		return { primary: `${Math.floor(diffMinutes / 60)}h ago`, secondary: null };
	}

	return {
		primary: matchDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
		secondary: matchDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
	};
}

function ScoreLine({
	players,
	score,
	isWinner,
	isMuted,
	headers,
}: {
	players: MatchDisplayPlayer[];
	score: number;
	isWinner: boolean;
	isMuted: boolean;
	headers?: Record<string, string>;
}) {
	const theme = useTheme();
	const teamInfo = getTeamInfo(players);

	return (
		<View style={styles.line}>
			<View style={styles.avatars}>
				{teamInfo ? (
					<Avatar name={teamInfo.name} image={teamInfo.logo} headers={headers} size={26} />
				) : (
					players.map((player) => (
						<Avatar
							key={player.id}
							name={player.name}
							image={player.image}
							headers={headers}
							size={26}
						/>
					))
				)}
			</View>
			<ThemedText
				numberOfLines={1}
				themeColor={isMuted ? "mutedForeground" : "foreground"}
				style={[styles.label, isWinner && styles.winner]}
			>
				{getSideLabel(players)}
			</ThemedText>
			<View
				style={[
					styles.scoreBadge,
					{ backgroundColor: `${theme.primary}1a`, borderColor: theme.border },
				]}
			>
				<ThemedText
					themeColor={isMuted ? "mutedForeground" : "foreground"}
					style={[styles.score, isWinner && styles.winner]}
				>
					{score}
				</ThemedText>
			</View>
		</View>
	);
}

function MatchRow({
	match,
	headers,
}: {
	match: {
		id: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
		homeTeam: MatchTeam;
		awayTeam: MatchTeam;
	};
	headers?: Record<string, string>;
}) {
	const toDisplay = (team: MatchTeam, homeTeam: boolean): MatchDisplayPlayer[] =>
		team.players.map((p) => ({
			id: p.id,
			name: p.name,
			image: getAvatarUri(p.image) ?? null,
			teamName: team.name,
			teamLogo: getAvatarUri(team.logo) ?? null,
			homeTeam,
		}));

	const homePlayers = toDisplay(match.homeTeam, true);
	const awayPlayers = toDisplay(match.awayTeam, false);
	const homeWins = match.homeScore > match.awayScore;
	const awayWins = match.awayScore > match.homeScore;
	const timestamp = formatTimestamp(match.createdAt);

	return (
		<View style={styles.matchRow}>
			<View style={styles.dateCol}>
				<ThemedText type="small" themeColor="mutedForeground">
					{timestamp.primary}
				</ThemedText>
				{timestamp.secondary ? (
					<ThemedText type="small" themeColor="mutedForeground">
						{timestamp.secondary}
					</ThemedText>
				) : null}
			</View>
			<View style={styles.lines}>
				<ScoreLine
					players={homePlayers}
					score={match.homeScore}
					isWinner={homeWins}
					isMuted={awayWins}
					headers={headers}
				/>
				<ScoreLine
					players={awayPlayers}
					score={match.awayScore}
					isWinner={awayWins}
					isMuted={homeWins}
					headers={headers}
				/>
			</View>
		</View>
	);
}

const Separator = () => <View style={styles.separator} />;

export function LatestMatches({
	seasonSlug,
	season,
	limit,
}: {
	seasonSlug: string;
	season?: { closed?: boolean | null; archived?: boolean | null } | null;
	limit?: number;
}) {
	const trpc = useTRPC();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const { data: activeMember } = authClient.useActiveMember();
	const [cookie, setCookie] = useState<string | undefined>();
	const [isRemoving, setIsRemoving] = useState(false);

	useEffect(() => {
		let active = true;
		getAuthCookie().then((c) => {
			if (active) setCookie(c);
		});
		return () => {
			active = false;
		};
	}, []);
	const avatarHeaders = cookie ? { cookie } : undefined;

	const matchesQuery = useQuery(
		trpc.match.getAll.queryOptions({ seasonSlug, limit: 30, offset: 0 })
	);
	const { refreshing, onRefresh } = usePullToRefresh(() => matchesQuery.refetch());
	const matches = matchesQuery.data?.matches ?? [];
	const latestMatch = matches[0];

	const role = activeMember?.role;
	const canRemove =
		(role === "owner" || role === "editor" || role === "member") &&
		!season?.closed &&
		!season?.archived;

	const handleRemove = async (matchId: string) => {
		setIsRemoving(true);
		try {
			await trpcClient.match.remove.mutate({ seasonSlug, matchId });
			queryClient.invalidateQueries({
				queryKey: trpc.match.getAll.queryKey({ seasonSlug, limit: 30, offset: 0 }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
			});
		} catch (err) {
			Alert.alert("Error", err instanceof Error ? err.message : "Failed to remove match");
		} finally {
			setIsRemoving(false);
		}
	};

	const confirmRemove = () => {
		if (!latestMatch || isRemoving) return;
		Alert.alert(
			"Remove latest match",
			"This will revert all player and team scores to their previous values. This cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Remove", style: "destructive", onPress: () => void handleRemove(latestMatch.id) },
			]
		);
	};

	const emptyState = matchesQuery.isPending ? (
		<View>
			{Array.from({ length: limit ?? 6 }).map((_, i) => (
				<SkeletonMatchRow key={i} />
			))}
		</View>
	) : matchesQuery.isError && matchesQuery.data === undefined ? (
		<View style={styles.emptyBox}>
			<ThemedText type="small" themeColor="mutedForeground" style={styles.empty}>
				Couldn't load matches
			</ThemedText>
			<Button variant="outline" onPress={() => matchesQuery.refetch()}>
				Retry
			</Button>
		</View>
	) : (
		<ThemedText type="small" themeColor="mutedForeground" style={styles.empty}>
			No registered matches
		</ThemedText>
	);

	if (limit !== undefined) {
		return (
			<StaticList
				data={matches.slice(0, limit)}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => <MatchRow match={item} headers={avatarHeaders} />}
				ItemSeparatorComponent={Separator}
				ListEmptyComponent={emptyState}
			/>
		);
	}

	return (
		<View style={styles.container}>
			{matches.length > 0 ? (
				<View style={styles.header}>
					<ThemedText type="smallBold">Latest Matches</ThemedText>
					{canRemove ? (
						<Pressable onPress={confirmRemove} disabled={isRemoving} hitSlop={8}>
							<ThemedText
								type="smallBold"
								style={{ color: theme.destructive, opacity: isRemoving ? 0.5 : 1 }}
							>
								{isRemoving ? "Removing…" : "Remove latest"}
							</ThemedText>
						</Pressable>
					) : null}
				</View>
			) : null}
			<FlatList
				style={styles.flatList}
				data={matches}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => <MatchRow match={item} headers={avatarHeaders} />}
				ItemSeparatorComponent={Separator}
				contentContainerStyle={styles.list}
				refreshing={refreshing}
				onRefresh={onRefresh}
				ListEmptyComponent={emptyState}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
	},
	flatList: {
		flex: 1,
	},
	list: {
		paddingHorizontal: Spacing.three,
		paddingBottom: Spacing.four,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: SharedColors.divider,
	},
	matchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.three,
	},
	dateCol: {
		width: 56,
	},
	lines: {
		flex: 1,
		gap: Spacing.two,
	},
	line: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	avatars: {
		flexDirection: "row",
		gap: 2,
	},
	label: {
		flex: 1,
		fontSize: 14,
	},
	winner: {
		fontWeight: "700",
	},
	scoreBadge: {
		minWidth: 28,
		height: 28,
		borderRadius: 6,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.one,
	},
	score: {
		fontSize: 14,
		fontVariant: ["tabular-nums"],
	},
	empty: {
		textAlign: "center",
		marginVertical: Spacing.three,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
});
