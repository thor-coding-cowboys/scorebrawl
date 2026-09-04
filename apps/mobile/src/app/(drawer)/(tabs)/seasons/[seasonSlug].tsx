import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { SeasonStandings } from "@/components/season-standings";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { getSeasonStatus } from "@/lib/collections/season";
import { setLastViewedSeason } from "@/lib/last-viewed-season";
import { useTRPC } from "@/lib/trpc";

function SubViewPlaceholder({ label }: { label: string }) {
	return (
		<View style={styles.center}>
			<ThemedText type="small" themeColor="textSecondary">
				{label} coming soon
			</ThemedText>
		</View>
	);
}

export default function SeasonOverviewScreen() {
	const { seasonSlug, view = "standings" } = useLocalSearchParams<{
		seasonSlug: string;
		view?: string;
	}>();
	const router = useRouter();
	const trpc = useTRPC();

	const {
		data: season,
		isLoading: seasonLoading,
		isError: seasonError,
		refetch: refetchSeason,
	} = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));

	const { activeLeague } = useActiveLeague();

	useEffect(() => {
		if (season && activeLeague && getSeasonStatus(season) === "active") {
			void setLastViewedSeason(activeLeague.id, season.slug);
		}
	}, [season, activeLeague]);

	const isLoading = seasonLoading;
	const isError = seasonError;

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
						Loading…
					</ThemedText>
				) : isError ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Couldn't load season
						</ThemedText>
						<Button variant="outline" onPress={() => refetchSeason()}>
							Retry
						</Button>
					</View>
				) : (
					<>
						{view === "matches" ? (
							<SubViewPlaceholder label="Matches" />
						) : view === "fixtures" ? (
							<SubViewPlaceholder label="Fixtures" />
						) : view === "history" ? (
							<SubViewPlaceholder label="History" />
						) : (
							<SeasonStandings seasonSlug={seasonSlug} />
						)}
					</>
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
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
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
