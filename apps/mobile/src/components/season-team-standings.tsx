import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { StandingRow, type StandingItem } from "@/components/standing-row";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getAuthCookie } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

const Separator = () => <View style={styles.separator} />;

export function SeasonTeamStandings({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
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
	const avatarHeaders = cookie ? { cookie } : undefined;

	const standingsQuery = useQuery(trpc.seasonTeam.getStanding.queryOptions({ seasonSlug }));
	const { refreshing, onRefresh } = usePullToRefresh(() => standingsQuery.refetch());
	const standings: StandingItem[] = [...(standingsQuery.data ?? [])]
		.sort((a, b) => {
			if (a.matchCount === 0 && b.matchCount !== 0) return 1;
			if (a.matchCount !== 0 && b.matchCount === 0) return -1;
			return b.score - a.score;
		})
		.map((item) => ({
			id: item.id,
			name: item.name,
			image: getAvatarUri(item.logo),
			score: item.score,
			matchCount: item.matchCount,
			winCount: item.winCount,
			pointDiff: item.pointDiff,
			form: item.form,
		}));

	return (
		<FlatList
			style={styles.flatList}
			data={standings}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => <StandingRow item={item} headers={avatarHeaders} />}
			ItemSeparatorComponent={Separator}
			contentContainerStyle={styles.list}
			refreshing={refreshing}
			onRefresh={onRefresh}
			ListEmptyComponent={
				standingsQuery.isPending ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						Loading standings…
					</ThemedText>
				) : standingsQuery.isError && standingsQuery.data === undefined ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Couldn't load team standings
						</ThemedText>
						<Button variant="outline" onPress={() => standingsQuery.refetch()}>
							Retry
						</Button>
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
	flatList: {
		flex: 1,
	},
	list: {
		paddingLeft: Spacing.three,
		paddingBottom: Spacing.four,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: "rgba(128,128,128,0.25)",
		marginLeft: 44,
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
