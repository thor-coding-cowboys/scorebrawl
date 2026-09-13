import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { StandingRow } from "@/components/standing-row";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { getAuthCookie } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

const Separator = () => <View style={styles.separator} />;

export function SeasonStandings({ seasonSlug }: { seasonSlug: string }) {
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

	const standingsQuery = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));
	const standings = [...(standingsQuery.data ?? [])].sort((a, b) => {
		if (a.matchCount === 0 && b.matchCount !== 0) return 1;
		if (a.matchCount !== 0 && b.matchCount === 0) return -1;
		return b.score - a.score;
	});

	return (
		<FlatList
			style={styles.flatList}
			data={standings}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => {
				const playerId = item.playerId;
				return (
					<StandingRow
						item={item}
						headers={avatarHeaders}
						onPress={
							playerId
								? () => router.push({ pathname: "/players/[playerId]", params: { playerId } })
								: undefined
						}
					/>
				);
			}}
			ItemSeparatorComponent={Separator}
			contentContainerStyle={styles.list}
			ListEmptyComponent={
				standingsQuery.isPending ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						Loading standings…
					</ThemedText>
				) : standingsQuery.isError ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Couldn't load standings
						</ThemedText>
						<Button variant="outline" onPress={() => standingsQuery.refetch()}>
							Retry
						</Button>
					</View>
				) : (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						No matches registered
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
