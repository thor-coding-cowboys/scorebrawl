import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { authClient, getAuthCookie } from "@/lib/auth-client";
import { trpcClient, useTRPC } from "@/lib/trpc";

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

interface DisplayPlayer {
	id: string;
	name: string;
	image: string | null;
	teamName: string | null;
	teamLogo: string | null;
}

function getTeamInfo(players: DisplayPlayer[]) {
	if (players.length <= 1) return null;
	const teamName = players[0]?.teamName;
	if (teamName) return { name: teamName, logo: players[0]?.teamLogo ?? null };
	return {
		name: players.map((p) => p.name.split(" ")[0]).join(" & "),
		logo: players[0]?.teamLogo ?? null,
	};
}

function getSideLabel(players: DisplayPlayer[]) {
	if (players.length === 0) return "Unknown";
	return getTeamInfo(players)?.name ?? players.map((p) => p.name).join(", ");
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
	players: DisplayPlayer[];
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
				themeColor={isMuted ? "textSecondary" : "text"}
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
					themeColor={isMuted ? "textSecondary" : "text"}
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
	const toDisplay = (team: MatchTeam): DisplayPlayer[] =>
		team.players.map((p) => ({
			id: p.id,
			name: p.name,
			image: getAvatarUri(p.image) ?? null,
			teamName: team.name,
			teamLogo: getAvatarUri(team.logo) ?? null,
		}));

	const homePlayers = toDisplay(match.homeTeam);
	const awayPlayers = toDisplay(match.awayTeam);
	const homeWins = match.homeScore > match.awayScore;
	const awayWins = match.awayScore > match.homeScore;
	const timestamp = formatTimestamp(match.createdAt);

	return (
		<View style={styles.matchRow}>
			<View style={styles.dateCol}>
				<ThemedText type="small" themeColor="textSecondary">
					{timestamp.primary}
				</ThemedText>
				{timestamp.secondary ? (
					<ThemedText type="small" themeColor="textSecondary">
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
}: {
	seasonSlug: string;
	season?: { closed?: boolean | null; archived?: boolean | null } | null;
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
				ListEmptyComponent={
					matchesQuery.isPending ? (
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Loading matches…
						</ThemedText>
					) : matchesQuery.isError && matchesQuery.data === undefined ? (
						<View style={styles.emptyBox}>
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Couldn't load matches
							</ThemedText>
							<Button variant="outline" onPress={() => matchesQuery.refetch()}>
								Retry
							</Button>
						</View>
					) : (
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							No registered matches
						</ThemedText>
					)
				}
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
		paddingBottom: Spacing.two,
	},
	flatList: {
		flex: 1,
	},
	list: {
		paddingBottom: Spacing.four,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: "rgba(128,128,128,0.25)",
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
		marginTop: Spacing.four,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
});
