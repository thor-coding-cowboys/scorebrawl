import type { DrawerContentComponentProps } from "expo-router/drawer";
import { router, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LeagueSwitcher } from "@/components/league-switcher";
import { UserCard } from "@/components/user-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function LeagueDrawerContent({ navigation }: DrawerContentComponentProps) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const pathname = usePathname();
	const isSeasonsActive = pathname.startsWith("/seasons");

	const handleSeasonsPress = () => {
		navigation.closeDrawer();
		router.push("/seasons");
	};

	return (
		<ThemedView
			style={[
				styles.container,
				{ paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
			]}
		>
			<LeagueSwitcher />

			<View style={styles.nav}>
				<ThemedText type="smallBold" themeColor="textSecondary" style={styles.navLabel}>
					League
				</ThemedText>
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ selected: isSeasonsActive }}
					onPress={handleSeasonsPress}
					style={({ pressed }) => [
						styles.navItem,
						isSeasonsActive && { backgroundColor: theme.backgroundElement },
						pressed && { opacity: 0.7 },
					]}
				>
					<SymbolView
						name={{ ios: "trophy", android: "emoji_events", web: "emoji_events" }}
						size={18}
						tintColor={theme.text}
					/>
					<ThemedText type="small">Seasons</ThemedText>
				</Pressable>
			</View>

			<View style={styles.footer}>
				<UserCard />
			</View>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: Spacing.three,
	},
	nav: {
		flex: 1,
		marginTop: Spacing.four,
	},
	navLabel: {
		marginBottom: Spacing.two,
		paddingHorizontal: Spacing.two,
	},
	navItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 0,
	},
	footer: {
		marginTop: Spacing.three,
	},
});
