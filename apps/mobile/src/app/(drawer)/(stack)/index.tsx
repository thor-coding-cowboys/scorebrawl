import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SeasonDashboard } from "@/components/season/season-dashboard";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { SkeletonHeader, SkeletonStandingRow } from "@/components/ui/skeleton-rows";
import { Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { useActiveSeasons } from "@/hooks/use-active-seasons";
import { getLastViewedSeason, setLastViewedSeason } from "@/lib/last-viewed-season";
import { useTRPC } from "@/lib/trpc";

function HomeSkeleton() {
	return (
		<ThemedView style={styles.skeleton}>
			<SkeletonHeader />
			{Array.from({ length: 7 }).map((_, i) => (
				<SkeletonStandingRow key={i} />
			))}
		</ThemedView>
	);
}

export default function HomeScreen() {
	const trpc = useTRPC();
	const { activeLeague, organizations, isLoading } = useActiveLeague();
	const { seasonSlug: paramSeasonSlug } = useLocalSearchParams<{ seasonSlug?: string }>();
	const activeSeasonsQuery = useActiveSeasons();
	const activeSeasons = useMemo(() => activeSeasonsQuery.data ?? [], [activeSeasonsQuery.data]);

	const activeLeagueId = activeLeague?.id;
	const [storedSeasonSlug, setStoredSeasonSlug] = useState<string | null>(null);
	const [storedSeasonResolved, setStoredSeasonResolved] = useState(false);

	useEffect(() => {
		if (!activeLeagueId) return;
		let cancelled = false;
		setStoredSeasonSlug(null);
		setStoredSeasonResolved(false);
		void getLastViewedSeason(activeLeagueId).then((slug) => {
			if (cancelled) return;
			setStoredSeasonSlug(slug);
			setStoredSeasonResolved(true);
		});
		return () => {
			cancelled = true;
		};
	}, [activeLeagueId]);

	const isActiveSlug = (slug: string | null | undefined): slug is string =>
		!!slug && activeSeasons.some((s) => s.slug === slug);

	const chosenSlug = isActiveSlug(paramSeasonSlug)
		? paramSeasonSlug
		: storedSeasonResolved && isActiveSlug(storedSeasonSlug)
			? storedSeasonSlug
			: (activeSeasons[0]?.slug ?? null);

	useEffect(() => {
		if (!chosenSlug || !activeLeagueId) return;
		if (chosenSlug !== paramSeasonSlug) router.setParams({ seasonSlug: chosenSlug });
		if (storedSeasonResolved && chosenSlug !== storedSeasonSlug) {
			setStoredSeasonSlug(chosenSlug);
			void setLastViewedSeason(activeLeagueId, chosenSlug);
		}
	}, [chosenSlug, paramSeasonSlug, activeLeagueId, storedSeasonSlug, storedSeasonResolved]);

	const seasonQuery = useQuery({
		...trpc.season.getBySlug.queryOptions({ seasonSlug: chosenSlug ?? "" }),
		enabled: !!chosenSlug,
	});

	useEffect(() => {
		if (
			!isLoading &&
			activeLeague &&
			activeSeasonsQuery.data !== undefined &&
			activeSeasons.length === 0
		) {
			router.replace("/seasons");
		}
	}, [isLoading, activeLeague, activeSeasonsQuery.data, activeSeasons.length]);

	if (isLoading) {
		return <HomeSkeleton />;
	}

	if (!organizations || organizations.length === 0) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText type="title" style={styles.centerText}>
					No league yet
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
					Create a league on scorebrawl.com to get started.
				</ThemedText>
				<View style={styles.centerButton}>
					<Button
						variant="outline"
						onPress={() => WebBrowser.openBrowserAsync("https://scorebrawl.com")}
					>
						Create a league
					</Button>
				</View>
			</ThemedView>
		);
	}

	if (activeSeasonsQuery.isError && activeSeasonsQuery.data === undefined) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
					Couldn't load the active season
				</ThemedText>
				<View style={styles.centerButton}>
					<Button variant="outline" onPress={() => activeSeasonsQuery.refetch()}>
						Retry
					</Button>
				</View>
			</ThemedView>
		);
	}

	if (!seasonQuery.data) {
		return <HomeSkeleton />;
	}

	return <SeasonDashboard season={seasonQuery.data} />;
}

const styles = StyleSheet.create({
	skeleton: {
		flex: 1,
		paddingHorizontal: Spacing.three,
	},
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.three,
		paddingHorizontal: Spacing.four,
	},
	centerText: {
		textAlign: "center",
	},
	centerButton: {
		marginTop: Spacing.four,
		width: "100%",
		maxWidth: 320,
	},
});
