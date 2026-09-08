import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { getAuthCookie } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

function memberSummary(players: { name: string | null }[]) {
	const firstNames = players.map((p) => p.name?.split(" ")[0] ?? "Unknown");
	if (firstNames.length === 0) return "No players";
	if (firstNames.length === 1) return firstNames[0];
	if (firstNames.length === 2) return `${firstNames[0]} & ${firstNames[1]}`;
	return `${firstNames.slice(0, -1).join(", ")} & ${firstNames[firstNames.length - 1]}`;
}

export default function TeamsScreen() {
	const trpc = useTRPC();
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

	const { data, isLoading, isError, refetch } = useQuery(
		trpc.leagueTeam.list.queryOptions({ limit: 100 })
	);
	const teams = data?.teams ?? [];

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Teams
				</ThemedText>
				<FlatList
					style={styles.list}
					data={teams}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<View style={styles.row}>
							<Avatar
								name={item.name}
								image={getAvatarUri(item.logo)}
								headers={avatarHeaders}
								size={40}
							/>
							<View style={styles.rowInfo}>
								<ThemedText style={styles.rowName} numberOfLines={1}>
									{item.name}
								</ThemedText>
								<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
									{memberSummary(item.players)}
								</ThemedText>
							</View>
						</View>
					)}
					contentContainerStyle={styles.listContent}
					ListEmptyComponent={
						isLoading ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Loading…
							</ThemedText>
						) : isError ? (
							<View style={styles.emptyBox}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
									Couldn’t load teams
								</ThemedText>
								<Button variant="outline" onPress={() => refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No teams yet
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
		flex: 1,
	},
	listContent: {
		paddingBottom: Spacing.six,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.25)",
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
