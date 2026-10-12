import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { LatestMatches } from "@/components/latest-matches";
import { MobileHeader } from "@/components/mobile-header";
import { SeasonStandings } from "@/components/season-standings";
import { ActiveSessionBanner } from "@/components/session/active-session-banner";
import { SeasonTeamStandings } from "@/components/season-team-standings";
import { SessionHistory } from "@/components/session-history";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { SkeletonStandingRow } from "@/components/ui/skeleton-rows";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { getSeasonStatus } from "@/lib/collections/season";
import { setLastViewedSeason } from "@/lib/last-viewed-season";
import { useTRPC } from "@/lib/trpc";

export default function SeasonOverviewScreen() {
	const { seasonSlug, view = "players" } = useLocalSearchParams<{
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
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<MobileHeader onBack={() => router.back()} title={season?.name ?? "Season"} />

				<ActiveSessionBanner seasonSlug={seasonSlug} />

				{isLoading ? (
					<View>
						{Array.from({ length: 6 }).map((_, i) => (
							<SkeletonStandingRow key={i} />
						))}
					</View>
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
							<LatestMatches seasonSlug={seasonSlug} season={season} />
						) : view === "session" ? (
							<SessionHistory seasonSlug={seasonSlug} />
						) : view === "teams" ? (
							<SeasonTeamStandings seasonSlug={seasonSlug} />
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
		paddingHorizontal: Spacing.three,
		paddingBottom: Spacing.three,
	},
	header: {
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
		gap: Spacing.two,
	},
	title: {
		marginTop: Spacing.one,
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
