import type { DrawerContentComponentProps } from "expo-router/drawer";
import { useGlobalSearchParams, usePathname, type Href } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LeagueSwitcher } from "@/components/league-switcher";
import { ThemedText } from "@/components/themed-text";
import {
	AnimatedCollapse,
	useCollapseProgress,
	useRotation,
} from "@/components/ui/animated-collapse";
import { UserCard } from "@/components/user-card";
import { Spacing } from "@/constants/theme";
import { useActiveSeasons } from "@/hooks/use-active-seasons";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { resetTo } from "@/lib/navigation";

type SymbolName = Parameters<typeof SymbolView>[0]["name"];

const NAV_ITEMS: {
	label: string;
	path: Href & string;
	icon: SymbolName;
	requireEditor?: boolean;
}[] = [
	{
		label: "Seasons",
		path: "/seasons",
		icon: { ios: "trophy", android: "emoji_events", web: "emoji_events" },
	},
	{ label: "Teams", path: "/teams", icon: { ios: "person.3", android: "groups", web: "groups" } },
	{ label: "Players", path: "/players", icon: { ios: "person", android: "person", web: "person" } },
	{
		label: "Achievements",
		path: "/achievements",
		icon: { ios: "medal", android: "military_tech", web: "military_tech" },
	},
	{
		label: "Members",
		path: "/members",
		icon: { ios: "person.2", android: "group", web: "group" },
		requireEditor: true,
	},
	{
		label: "Invitations",
		path: "/invitations",
		icon: { ios: "envelope", android: "mail", web: "mail" },
		requireEditor: true,
	},
];

const ACTIVE_SEASON_ICON: SymbolName = {
	ios: "waveform.path.ecg",
	android: "monitor_heart",
	web: "monitor_heart",
};

export function LeagueDrawerContent({ navigation }: DrawerContentComponentProps) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const pathname = usePathname();
	const { seasonSlug } = useGlobalSearchParams<{ seasonSlug?: string }>();
	const { data: activeMember } = authClient.useActiveMember();
	const canManage = activeMember?.role === "owner" || activeMember?.role === "editor";
	const { data: activeSeasons = [] } = useActiveSeasons();
	const [seasonsOpen, setSeasonsOpen] = useState(true);
	const seasonsProgress = useCollapseProgress(seasonsOpen);
	const seasonsChevronStyle = useRotation(seasonsProgress, 90);

	const isOnActiveSeason =
		pathname === "/" ||
		(pathname.startsWith("/seasons/") &&
			!pathname.includes("/session/") &&
			activeSeasons.some((s) => s.slug === seasonSlug));

	const go = (href: Href) => {
		navigation.closeDrawer();
		resetTo(href);
	};

	const visibleItems = NAV_ITEMS.filter((item) => !item.requireEditor || canManage);

	return (
		<View
			style={[
				styles.container,
				{ backgroundColor: theme.card, paddingTop: insets.top, paddingBottom: insets.bottom },
			]}
		>
			<View style={[styles.header, { borderBottomColor: theme.border }]}>
				<LeagueSwitcher />
			</View>

			<ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
				<ThemedText type="small" themeColor="mutedForeground" style={styles.groupLabel}>
					League
				</ThemedText>

				{activeSeasons.length === 1 ? (
					<NavRow
						label="Active Season"
						icon={ACTIVE_SEASON_ICON}
						active={isOnActiveSeason}
						onPress={() => go({ pathname: "/", params: { seasonSlug: activeSeasons[0].slug } })}
					/>
				) : activeSeasons.length > 1 ? (
					<>
						<NavRow
							label="Active Seasons"
							icon={ACTIVE_SEASON_ICON}
							active={isOnActiveSeason && !seasonsOpen}
							onPress={() => setSeasonsOpen((open) => !open)}
							trailing={
								<Animated.View style={seasonsChevronStyle}>
									<SymbolView
										name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
										size={12}
										weight="semibold"
										tintColor={theme.mutedForeground}
									/>
								</Animated.View>
							}
						/>
						<AnimatedCollapse
							expanded={seasonsOpen}
							progress={seasonsProgress}
							style={[styles.subList, { borderLeftColor: theme.border }]}
						>
							{activeSeasons.map((season) => (
								<Pressable
									key={season.id}
									accessibilityRole="button"
									accessibilityState={{
										selected: isOnActiveSeason && seasonSlug === season.slug,
									}}
									onPress={() => go({ pathname: "/", params: { seasonSlug: season.slug } })}
									style={({ pressed }) => [
										styles.subItem,
										isOnActiveSeason &&
											seasonSlug === season.slug && { backgroundColor: theme.muted },
										pressed && styles.pressed,
									]}
								>
									<ThemedText type="small" numberOfLines={1}>
										{season.name}
									</ThemedText>
								</Pressable>
							))}
						</AnimatedCollapse>
					</>
				) : null}

				{visibleItems.map((item) => (
					<NavRow
						key={item.path}
						label={item.label}
						icon={item.icon}
						active={
							item.path === "/seasons"
								? pathname === "/seasons" || (pathname.startsWith("/seasons/") && !isOnActiveSeason)
								: pathname.startsWith(item.path)
						}
						onPress={() => go(item.path)}
					/>
				))}
			</ScrollView>

			<View style={[styles.footer, { borderTopColor: theme.border }]}>
				<UserCard />
			</View>
		</View>
	);
}

function NavRow({
	label,
	icon,
	active,
	onPress,
	trailing,
}: {
	label: string;
	icon: SymbolName;
	active: boolean;
	onPress: () => void;
	trailing?: React.ReactNode;
}) {
	const theme = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.navItem,
				active && { backgroundColor: theme.muted },
				pressed && styles.pressed,
			]}
		>
			<SymbolView name={icon} size={17} tintColor={theme.foreground} />
			<ThemedText type={active ? "smallBold" : "small"} style={styles.navLabel}>
				{label}
			</ThemedText>
			{trailing}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	nav: {
		flex: 1,
	},
	navContent: {
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.three,
		gap: 2,
	},
	groupLabel: {
		fontSize: 12,
		paddingHorizontal: Spacing.two,
		marginBottom: Spacing.one,
	},
	navItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		minHeight: 40,
		paddingHorizontal: Spacing.two,
	},
	navLabel: {
		flex: 1,
	},
	subList: {
		marginLeft: Spacing.four,
		paddingLeft: Spacing.two,
		borderLeftWidth: 1,
		gap: 2,
		marginBottom: Spacing.one,
	},
	subItem: {
		minHeight: 36,
		justifyContent: "center",
		paddingHorizontal: Spacing.two,
	},
	pressed: {
		opacity: 0.6,
	},
	footer: {
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.two,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
});
