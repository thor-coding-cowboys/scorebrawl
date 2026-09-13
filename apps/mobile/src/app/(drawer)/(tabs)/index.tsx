import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LatestMatches } from "@/components/latest-matches";
import { MobileHeader } from "@/components/mobile-header";
import { SeasonStandings } from "@/components/season-standings";
import { ActiveSessionBanner } from "@/components/session/active-session-banner";
import { SeasonTeamStandings } from "@/components/season-team-standings";
import { SessionHistory } from "@/components/session-history";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
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
	const [resolvedSeasonSlug, setResolvedSeasonSlug] = useState<string | null>(null);
	const [resolvingSeason, setResolvingSeason] = useState(true);

	useFocusEffect(
		useCallback(() => {
			if (!activeLeague || activeSeasonsQuery.isPending) return;
			let cancelled = false;
			setResolvedSeasonSlug(null);
			setResolvingSeason(true);
			(async () => {
				const active = activeSeasons ?? [];
				if (active.length === 0) {
					if (!cancelled) setResolvedSeasonSlug(null);
					if (!cancelled) setResolvingSeason(false);
					return;
				}
				const stored = await getLastViewedSeason(activeLeague.id);
				const storedStillActive = stored ? active.some((s) => s.slug === stored) : false;
				const chosen = storedStillActive ? stored : active[0].slug;
				if (!cancelled) setResolvedSeasonSlug(chosen);
				if (chosen && chosen !== paramSeasonSlug) {
					router.setParams({ seasonSlug: chosen });
				}
				if (chosen && !storedStillActive) {
					void setLastViewedSeason(activeLeague.id, chosen);
				}
				if (!cancelled) setResolvingSeason(false);
			})();
			return () => {
				cancelled = true;
			};
		}, [activeLeague, activeSeasonsQuery.isPending, activeSeasons, paramSeasonSlug])
	);

	const activeSeason = activeSeasons?.find((s) => s.slug === resolvedSeasonSlug) ?? null;

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

	if (activeSeasonsQuery.isError) {
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

	if (activeSeasonsQuery.isPending || resolvingSeason) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText type="small" themeColor="textSecondary">
					Loading active season…
				</ThemedText>
			</ThemedView>
		);
	}

	if (resolvedSeasonSlug === null) {
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
				{activeSeason && <MobileHeader eyebrow={activeLeague.name} title={activeSeason.name} />}
				{activeSeason ? <ActiveSessionBanner seasonSlug={activeSeason.slug} /> : null}
				{activeSeason &&
					(view === "matches" ? (
						<LatestMatches seasonSlug={activeSeason.slug} season={activeSeason} />
					) : view === "session" ? (
						<SessionHistory seasonSlug={activeSeason.slug} />
					) : view === "teams" ? (
						<SeasonTeamStandings seasonSlug={activeSeason.slug} />
					) : (
						<SeasonStandings seasonSlug={activeSeason.slug} />
					))}
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
