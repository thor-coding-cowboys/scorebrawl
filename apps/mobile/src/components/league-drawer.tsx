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
import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
	{
		label: "Seasons",
		path: "/seasons",
		icon: { ios: "trophy", android: "emoji_events", web: "emoji_events" },
	},
	{ label: "Teams", path: "/teams", icon: { ios: "person.3", android: "groups", web: "groups" } },
	{ label: "Players", path: "/players", icon: { ios: "person", android: "person", web: "person" } },
	{
		label: "Members",
		path: "/members",
		icon: { ios: "shield", android: "verified_user", web: "verified_user" },
		requireEditor: true,
	},
	{
		label: "Invitations",
		path: "/invitations",
		icon: { ios: "envelope", android: "mail", web: "mail" },
		requireEditor: true,
	},
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

export function LeagueDrawerContent({ navigation }: DrawerContentComponentProps) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const pathname = usePathname();
	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canManage = role === "owner" || role === "editor";

	const handleNavPress = (path: NavItem["path"]) => {
		navigation.closeDrawer();
		router.push(path);
	};

	const visibleItems = NAV_ITEMS.filter(
		(item) => !("requireEditor" in item && item.requireEditor) || canManage
	);

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
				{visibleItems.map((item) => {
					const isActive = pathname.startsWith(item.path);
					return (
						<Pressable
							key={item.path}
							accessibilityRole="button"
							accessibilityState={{ selected: isActive }}
							onPress={() => handleNavPress(item.path)}
							style={({ pressed }) => [
								styles.navItem,
								isActive && { backgroundColor: theme.backgroundElement },
								pressed && { opacity: 0.7 },
							]}
						>
							<SymbolView name={item.icon} size={18} tintColor={theme.text} />
							<ThemedText type="small">{item.label}</ThemedText>
						</Pressable>
					);
				})}
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
