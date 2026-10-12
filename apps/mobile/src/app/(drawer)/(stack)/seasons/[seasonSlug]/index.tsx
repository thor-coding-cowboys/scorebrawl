import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { SeasonDashboard } from "@/components/season/season-dashboard";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { SkeletonStandingRow } from "@/components/ui/skeleton-rows";
import { Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { getSeasonStatus } from "@/lib/collections/season";
import { setLastViewedSeason } from "@/lib/last-viewed-season";
import { useTRPC } from "@/lib/trpc";

export default function SeasonOverviewScreen() {
	const { seasonSlug } = useLocalSearchParams<{ seasonSlug: string }>();
	const trpc = useTRPC();
	const { activeLeague } = useActiveLeague();
	const seasonQuery = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));
	const season = seasonQuery.data;

	useEffect(() => {
		if (season && activeLeague && getSeasonStatus(season) === "active") {
			void setLastViewedSeason(activeLeague.id, season.slug);
		}
	}, [season, activeLeague]);

	if (season) return <SeasonDashboard season={season} />;

	if (seasonQuery.isError) {
		return (
			<View style={styles.emptyBox}>
				<ThemedText type="small" themeColor="textSecondary">
					Couldn't load season
				</ThemedText>
				<Button variant="outline" onPress={() => seasonQuery.refetch()}>
					Retry
				</Button>
			</View>
		);
	}

	return (
		<View style={styles.skeleton}>
			{Array.from({ length: 6 }).map((_, i) => (
				<SkeletonStandingRow key={i} />
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	skeleton: {
		paddingHorizontal: Spacing.three,
		paddingTop: Spacing.three,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
		marginTop: Spacing.five,
	},
});
