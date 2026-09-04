import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { useTheme } from "@/hooks/use-theme";
import { formatDate, getSeasonStatus } from "@/lib/collections/season";
import { useTRPC } from "@/lib/trpc";

export default function SeasonsScreen() {
	const trpc = useTRPC();
	const theme = useTheme();
	const screenRouter = useRouter();
	const { activeLeague } = useActiveLeague();
	const {
		data: seasons = [],
		isLoading,
		isError,
		refetch,
	} = useQuery(trpc.season.getAll.queryOptions());
	const { data: activeSeason } = useQuery(
		trpc.season.findActive.queryOptions(undefined, { enabled: Boolean(activeLeague) })
	);

	const handlePress = (slug: string) => {
		if (!slug) {
			console.warn("Season slug is missing");
			return;
		}
		if (slug === activeSeason?.slug) {
			router.replace("/");
			return;
		}
		screenRouter.navigate(`/seasons/${slug}`);
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Seasons
				</ThemedText>
				<FlatList
					data={seasons}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => {
						const status = getSeasonStatus(item);
						const isActive = item.id === activeSeason?.id;
						return (
							<Pressable
								accessibilityRole="button"
								onPress={() => handlePress(item.slug)}
								style={({ pressed }) => [
									styles.row,
									isActive && { backgroundColor: theme.backgroundSelected },
									pressed && styles.rowPressed,
								]}
							>
								<View style={styles.rowInfo}>
									<ThemedText style={[styles.rowName, isActive && { color: theme.primary }]}>
										{item.name}
									</ThemedText>
									<ThemedText type="small" themeColor="textSecondary">
										{formatDate(item.startDate)}
										{item.endDate ? ` → ${formatDate(item.endDate)}` : ""}
									</ThemedText>
								</View>
								<View style={styles.statusBox}>
									<ThemedText
										type="smallBold"
										style={isActive ? { color: theme.primary } : undefined}
									>
										{isActive ? "Active" : status}
									</ThemedText>
								</View>
							</Pressable>
						);
					}}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						isLoading ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Loading…
							</ThemedText>
						) : isError ? (
							<View style={styles.emptyBox}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
									Couldn’t load seasons
								</ThemedText>
								<Button variant="outline" onPress={() => refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No seasons yet
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
	title: {
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
	list: {
		paddingBottom: Spacing.four,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.25)",
	},
	rowPressed: {
		backgroundColor: "rgba(128,128,128,0.08)",
	},
	rowInfo: {
		flex: 1,
	},
	rowName: {
		fontWeight: "600",
	},
	statusBox: {
		marginLeft: Spacing.three,
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
