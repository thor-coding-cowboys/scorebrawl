import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StandingRow } from "@/components/standing-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { getAuthCookie } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

export default function HomeScreen() {
	const trpc = useTRPC();
	const { activeLeague, organizations, isLoading } = useActiveLeague();

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

	const activeSeasonQuery = useQuery(
		trpc.season.findActive.queryOptions(undefined, { enabled: Boolean(activeLeague) })
	);
	const activeSeason = activeSeasonQuery.data;
	const standingsQuery = useQuery(
		trpc.seasonPlayer.getStanding.queryOptions(
			{ seasonSlug: activeSeason?.slug ?? "" },
			{ enabled: Boolean(activeSeason) }
		)
	);
	const sortedStandings = [...(standingsQuery.data ?? [])].sort((a, b) => {
		if (a.matchCount === 0 && b.matchCount !== 0) return 1;
		if (a.matchCount !== 0 && b.matchCount === 0) return -1;
		return b.score - a.score;
	});

	useEffect(() => {
		if (!isLoading && activeLeague && activeSeasonQuery.data === null) {
			router.replace("/seasons");
		}
	}, [isLoading, activeLeague, activeSeasonQuery.data]);

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

	if (activeSeasonQuery.isError) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
					Couldn't load the active season
				</ThemedText>
				<View style={styles.centerButton}>
					<Button variant="outline" onPress={() => activeSeasonQuery.refetch()}>
						Retry
					</Button>
				</View>
			</ThemedView>
		);
	}

	if (activeSeasonQuery.data === null) {
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
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				{activeSeason && (
					<View style={styles.header}>
						<ThemedText type="small" themeColor="textSecondary">
							{activeLeague.name}
						</ThemedText>
						<ThemedText type="title">{activeSeason.name}</ThemedText>
					</View>
				)}
				<FlatList
					data={sortedStandings}
					keyExtractor={(item) => item.id}
					renderItem={({ item, index }) => (
						<StandingRow item={item} rank={index + 1} headers={avatarHeaders} />
					)}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						standingsQuery.isPending ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
								Loading standings…
							</ThemedText>
						) : standingsQuery.isError ? (
							<View style={styles.emptyBox}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
									Couldn't load standings
								</ThemedText>
								<Button variant="outline" onPress={() => standingsQuery.refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
								No matches registered
							</ThemedText>
						)
					}
				/>
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
	list: {
		paddingBottom: Spacing.four,
	},
	emptyText: {
		textAlign: "center",
		marginTop: Spacing.four,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
});
