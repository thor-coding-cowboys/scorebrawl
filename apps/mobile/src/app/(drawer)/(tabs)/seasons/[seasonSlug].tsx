import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { StandingRow } from "@/components/standing-row";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTRPC } from "@/lib/trpc";

export default function SeasonOverviewScreen() {
	const { seasonSlug } = useLocalSearchParams<{ seasonSlug: string }>();
	const router = useRouter();
	const trpc = useTRPC();

	const {
		data: season,
		isLoading: seasonLoading,
		isError: seasonError,
	} = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));

	const {
		data: standings = [],
		isLoading: standingsLoading,
		isError: standingsError,
		refetch,
	} = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));

	const isLoading = seasonLoading || standingsLoading;
	const isError = seasonError || standingsError;

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()}>
						<ThemedText type="small" themeColor="primary">
							← Back
						</ThemedText>
					</Pressable>
					<ThemedText type="title" style={styles.title}>
						{season?.name ?? "Season"}
					</ThemedText>
				</View>

				{isLoading ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						Loading standings…
					</ThemedText>
				) : isError ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Couldn’t load standings
						</ThemedText>
						<Button variant="outline" onPress={() => refetch()}>
							Retry
						</Button>
					</View>
				) : (
					<FlatList
						data={standings}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => (
							<StandingRow
								item={{
									id: item.id,
									name: item.name,
									image: item.image,
									score: item.score,
									matchCount: item.matchCount,
									winCount: item.winCount,
									pointDiff: item.pointDiff,
								}}
								rank={item.rank}
							/>
						)}
						contentContainerStyle={styles.list}
						ListEmptyComponent={
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No players in this season yet
							</ThemedText>
						}
					/>
				)}
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
	},
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.four,
		paddingBottom: BottomTabInset + Spacing.three,
	},
	header: {
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
		gap: Spacing.two,
	},
	title: {
		marginTop: Spacing.one,
	},
	list: {
		paddingBottom: Spacing.four,
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
});
