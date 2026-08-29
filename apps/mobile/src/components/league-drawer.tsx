import type { DrawerContentComponentProps } from "expo-router/drawer";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { authClient } from "@/lib/auth-client";

export function LeagueDrawerContent({ navigation }: DrawerContentComponentProps) {
	const { activeLeague, organizations, switchLeague } = useActiveLeague();
	const { data } = authClient.useSession();
	const user = data?.user;

	const handleLeaguePress = async (organizationId: string) => {
		const ok = await switchLeague(organizationId);
		if (ok) {
			navigation.closeDrawer();
		}
	};

	const handleSignOut = async () => {
		await authClient.signOut();
		router.replace("/sign-in");
	};

	return (
		<ThemedView style={styles.container}>
			<View style={styles.userHeader}>
				<Avatar name={user?.name ?? ""} image={user?.image} size={40} />
				<View style={styles.userInfo}>
					<ThemedText type="subtitle">{user?.name}</ThemedText>
					<ThemedText type="small" themeColor="textSecondary">
						{user?.email}
					</ThemedText>
				</View>
			</View>

			<Pressable
				onPress={() => {
					navigation.closeDrawer();
					router.push("/profile" as Href);
				}}
				style={styles.menuItem}
			>
				<ThemedText>Profile settings</ThemedText>
			</Pressable>

			<ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
				Leagues
			</ThemedText>

			<ScrollView style={styles.leagueList}>
				{(organizations ?? []).map((org) => {
					const isActive = org.id === activeLeague?.id;
					return (
						<Pressable
							key={org.id}
							onPress={() => handleLeaguePress(org.id)}
							style={[styles.leagueItem, isActive && styles.leagueItemActive]}
						>
							<Avatar name={org.name} size={28} />
							<ThemedText style={styles.leagueName} numberOfLines={1}>
								{org.name}
							</ThemedText>
							{isActive && <ThemedText themeColor="primary">✓</ThemedText>}
						</Pressable>
					);
				})}
			</ScrollView>

			<View style={styles.signOutContainer}>
				<Button variant="outline" fullWidth onPress={handleSignOut}>
					Sign out
				</Button>
			</View>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: Spacing.three,
		paddingTop: Spacing.five,
		paddingBottom: Spacing.four,
	},
	userHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		marginBottom: Spacing.four,
	},
	userInfo: {
		flex: 1,
	},
	menuItem: {
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.3)",
	},
	sectionLabel: {
		marginTop: Spacing.four,
		marginBottom: Spacing.two,
	},
	leagueList: {
		flex: 1,
	},
	leagueItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 10,
	},
	leagueItemActive: {
		backgroundColor: "rgba(128,128,128,0.12)",
	},
	leagueName: {
		flex: 1,
	},
	signOutContainer: {
		marginTop: Spacing.three,
	},
});
