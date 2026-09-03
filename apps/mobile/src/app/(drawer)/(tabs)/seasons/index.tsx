import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { formatDate, getSeasonStatus } from "@/lib/collections/season";
import { useTRPC } from "@/lib/trpc";

export default function SeasonsScreen() {
	const trpc = useTRPC();
	const router = useRouter();
	const {
		data: seasons = [],
		isLoading,
		isError,
		refetch,
	} = useQuery(trpc.season.getAll.queryOptions());

	const handlePress = (slug: string) => {
		if (!slug) {
			console.warn("Season slug is missing");
			return;
		}
		router.navigate(`/seasons/${slug}`);
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
						return (
							<Pressable
								accessibilityRole="button"
								onPress={() => handlePress(item.slug)}
								style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
							>
								<View style={styles.rowInfo}>
									<ThemedText style={styles.rowName}>{item.name}</ThemedText>
									<ThemedText type="small" themeColor="textSecondary">
										{formatDate(item.startDate)}
										{item.endDate ? ` → ${formatDate(item.endDate)}` : ""}
									</ThemedText>
								</View>
								<ThemedText type="smallBold">{status}</ThemedText>
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
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
});
