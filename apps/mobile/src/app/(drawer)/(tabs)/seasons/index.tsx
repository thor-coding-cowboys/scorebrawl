import { SymbolView } from "expo-symbols";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { formatDate, getSeasonStatus } from "@/lib/collections/season";
import { useTRPC } from "@/lib/trpc";

function StatusPill({
	status,
}: {
	status: "active" | "upcoming" | "ended" | "locked" | "archived";
}) {
	const config: Record<string, { color: string; icon: Parameters<typeof SymbolView>[0]["name"] }> =
		{
			active: {
				color: "#16a34a",
				icon: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
			},
			upcoming: {
				color: "#2563eb",
				icon: { ios: "clock.fill", android: "schedule", web: "schedule" },
			},
			ended: { color: "#d97706", icon: { ios: "flag.fill", android: "flag", web: "flag" } },
			locked: { color: "#6b7280", icon: { ios: "lock.fill", android: "lock", web: "lock" } },
			archived: {
				color: "#9ca3af",
				icon: { ios: "archivebox.fill", android: "archive", web: "archive" },
			},
		};
	const { color, icon } = config[status] ?? config.ended;
	return (
		<View style={[styles.pill, { backgroundColor: `${color}1a`, borderColor: `${color}40` }]}>
			<SymbolView name={icon} size={12} tintColor={color} />
			<ThemedText type="small" style={{ color, fontSize: 11 }}>
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</ThemedText>
		</View>
	);
}

export default function SeasonsScreen() {
	const trpc = useTRPC();
	const screenRouter = useRouter();
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
		screenRouter.navigate(`/seasons/${slug}`);
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
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
								<StatusPill status={status} />
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
		paddingBottom: Spacing.three,
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
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
		borderWidth: 1,
		borderRadius: 8,
		paddingVertical: 2,
		paddingHorizontal: Spacing.two,
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
