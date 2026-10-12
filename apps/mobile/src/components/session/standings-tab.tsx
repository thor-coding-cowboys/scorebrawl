import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { StandingRow, type StandingItem } from "@/components/standing-row";
import type { SessionPlayer } from "@/components/session/types";
import { ThemedText } from "@/components/themed-text";
import { SkeletonStandingRow } from "@/components/ui/skeleton-rows";
import { Spacing } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { getAuthCookie } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

const Separator = () => <View style={styles.separator} />;

function useAvatarHeaders() {
	const [cookie, setCookie] = useState<string | undefined>();
	useEffect(() => {
		let active = true;
		getAuthCookie().then((c) => {
			if (active) setCookie(c);
		});
		return () => {
			active = false;
		};
	}, []);
	return cookie ? { cookie } : undefined;
}

export function SessionPlayerStandings({
	seasonSlug,
	sessionPlayers,
}: {
	seasonSlug: string;
	sessionPlayers: SessionPlayer[];
}) {
	const trpc = useTRPC();
	const headers = useAvatarHeaders();
	const highlight = useMemo(
		() => new Set(sessionPlayers.map((p) => p.seasonPlayerId)),
		[sessionPlayers]
	);

	const query = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));
	const { refreshing, onRefresh } = usePullToRefresh(() => query.refetch());
	const standings: (StandingItem & { dimmed: boolean })[] = [...(query.data ?? [])]
		.sort((a, b) => {
			if (a.matchCount === 0 && b.matchCount !== 0) return 1;
			if (a.matchCount !== 0 && b.matchCount === 0) return -1;
			return b.score - a.score;
		})
		.map((item) => ({
			id: item.id,
			name: item.name,
			image: item.image,
			score: item.score,
			matchCount: item.matchCount,
			winCount: item.winCount,
			pointDiff: item.pointDiff,
			form: item.form,
			dimmed: !highlight.has(item.id),
		}));

	return (
		<FlatList
			style={styles.flatList}
			data={standings}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => <StandingRow item={item} headers={headers} dimmed={item.dimmed} />}
			ItemSeparatorComponent={Separator}
			contentContainerStyle={styles.list}
			refreshing={refreshing}
			onRefresh={onRefresh}
			ListEmptyComponent={
				query.isPending ? (
					<View>
						{Array.from({ length: 5 }).map((_, i) => (
							<SkeletonStandingRow key={i} />
						))}
					</View>
				) : (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						No standings
					</ThemedText>
				)
			}
		/>
	);
}

export function SessionTeamStandings({
	seasonSlug,
	sessionPlayers,
}: {
	seasonSlug: string;
	sessionPlayers: SessionPlayer[];
}) {
	const trpc = useTRPC();
	const headers = useAvatarHeaders();

	const playersQuery = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));
	const teamsQuery = useQuery(trpc.seasonTeam.getStanding.queryOptions({ seasonSlug }));
	const { refreshing, onRefresh } = usePullToRefresh(() =>
		Promise.all([playersQuery.refetch(), teamsQuery.refetch()])
	);

	const highlightLeaguePlayerIds = useMemo(() => {
		const sessionSeasonPlayerIds = new Set(sessionPlayers.map((p) => p.seasonPlayerId));
		const ids = new Set<string>();
		for (const s of playersQuery.data ?? []) {
			if (sessionSeasonPlayerIds.has(s.id)) ids.add(s.playerId);
		}
		return ids;
	}, [playersQuery.data, sessionPlayers]);

	const standings: (StandingItem & { dimmed: boolean })[] = [...(teamsQuery.data ?? [])]
		.sort((a, b) => {
			if (a.matchCount === 0 && b.matchCount !== 0) return 1;
			if (a.matchCount !== 0 && b.matchCount === 0) return -1;
			return b.score - a.score;
		})
		.map((item) => ({
			id: item.id,
			name: item.name,
			image: getAvatarUri(item.logo) ?? null,
			score: item.score,
			matchCount: item.matchCount,
			winCount: item.winCount,
			pointDiff: item.pointDiff,
			form: item.form,
			dimmed: !item.players.every((p) => highlightLeaguePlayerIds.has(p.id)),
		}));

	return (
		<FlatList
			style={styles.flatList}
			data={standings}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => <StandingRow item={item} headers={headers} dimmed={item.dimmed} />}
			ItemSeparatorComponent={Separator}
			contentContainerStyle={styles.list}
			refreshing={refreshing}
			onRefresh={onRefresh}
			ListEmptyComponent={
				teamsQuery.isPending ? (
					<View>
						{Array.from({ length: 5 }).map((_, i) => (
							<SkeletonStandingRow key={i} />
						))}
					</View>
				) : (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						No team standings
					</ThemedText>
				)
			}
		/>
	);
}

const styles = StyleSheet.create({
	flatList: { flex: 1 },
	list: {
		paddingLeft: Spacing.three,
		paddingBottom: Spacing.four,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: "rgba(128,128,128,0.25)",
		marginLeft: 44,
	},
	empty: { textAlign: "center", marginTop: Spacing.four },
});
