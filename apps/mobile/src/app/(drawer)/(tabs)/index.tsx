import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LatestMatches } from "@/components/latest-matches";
import { MobileHeader } from "@/components/mobile-header";
import { SeasonStandings } from "@/components/season-standings";
import { ActiveSessionBanner } from "@/components/session/active-session-banner";
import { SCORE_TYPE_CONFIG, type ScoreType } from "@/components/score-type-card";
import { SeasonTeamStandings } from "@/components/season-team-standings";
import { SessionHistory } from "@/components/session-history";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { formatDate } from "@/lib/collections/season";
import { getLastViewedSeason, setLastViewedSeason } from "@/lib/last-viewed-season";
import { trpcClient } from "@/lib/trpc";

export default function HomeScreen() {
	const { activeLeague, organizations, isLoading } = useActiveLeague();

	const { view = "players", seasonSlug: paramSeasonSlug } = useLocalSearchParams<{
		view?: string;
		seasonSlug?: string;
	}>();
	const activeSeasonsQuery = useQuery({
		queryKey: ["season", "findAllActive", activeLeague?.id],
		queryFn: () => trpcClient.season.findAllActive.query(),
		enabled: Boolean(activeLeague),
	});
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

	// Only trust the stored slug once its read has settled. Before that we fall
	// back to the first active season for instant paint, but must not write it
	// back or we'd clobber a valid last-viewed season before the read resolves.
	const chosenSlug =
		storedSeasonResolved &&
		storedSeasonSlug &&
		activeSeasons.some((s) => s.slug === storedSeasonSlug)
			? storedSeasonSlug
			: (activeSeasons[0]?.slug ?? null);
	const activeSeason = activeSeasons.find((s) => s.slug === chosenSlug) ?? null;

	useEffect(() => {
		if (!chosenSlug || !activeLeagueId) return;
		if (chosenSlug !== paramSeasonSlug) router.setParams({ seasonSlug: chosenSlug });
		if (storedSeasonResolved && chosenSlug !== storedSeasonSlug) {
			void setLastViewedSeason(activeLeagueId, chosenSlug);
		}
	}, [chosenSlug, paramSeasonSlug, activeLeagueId, storedSeasonSlug, storedSeasonResolved]);

	const seasonScoreConfig = activeSeason
		? (SCORE_TYPE_CONFIG[activeSeason.scoreType as ScoreType] ?? SCORE_TYPE_CONFIG.elo)
		: null;
	const seasonDateRange = activeSeason
		? `${formatDate(activeSeason.startDate)}${activeSeason.endDate ? ` — ${formatDate(activeSeason.endDate)}` : ""}`
		: null;

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
		return (
			<ThemedView style={styles.center}>
				<ThemedText>Loading…</ThemedText>
			</ThemedView>
		);
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

	if (activeSeasonsQuery.isPending && activeSeasonsQuery.data === undefined) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText type="small" themeColor="textSecondary">
					Loading active season…
				</ThemedText>
			</ThemedView>
		);
	}

	if (activeSeason === null) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText type="small" themeColor="textSecondary">
					No active season
				</ThemedText>
			</ThemedView>
		);
	}

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				{seasonScoreConfig && (
					<MobileHeader
						eyebrow={`${seasonScoreConfig.label} · ${seasonDateRange}`}
						title={activeSeason.name}
					/>
				)}
				<ActiveSessionBanner seasonSlug={activeSeason.slug} />
				{view === "matches" ? (
					<LatestMatches seasonSlug={activeSeason.slug} season={activeSeason} />
				) : view === "session" ? (
					<SessionHistory seasonSlug={activeSeason.slug} />
				) : view === "teams" ? (
					<SeasonTeamStandings seasonSlug={activeSeason.slug} />
				) : (
					<SeasonStandings seasonSlug={activeSeason.slug} />
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
	header: {
		gap: Spacing.one,
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
});
