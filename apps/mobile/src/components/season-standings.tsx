import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { StandingRow } from "@/components/standing-row";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { useTRPC } from "@/lib/trpc";

export function SeasonStandings({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const standingsQuery = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));
	const standings = [...(standingsQuery.data ?? [])].sort((a, b) => {
		if (a.matchCount === 0 && b.matchCount !== 0) return 1;
		if (a.matchCount !== 0 && b.matchCount === 0) return -1;
		return b.score - a.score;
	});

	return (
		<FlatList
			data={standings}
			keyExtractor={(item) => item.id}
			renderItem={({ item, index }) => <StandingRow item={item} rank={index + 1} />}
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
	list: {
		paddingBottom: Spacing.four,
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
