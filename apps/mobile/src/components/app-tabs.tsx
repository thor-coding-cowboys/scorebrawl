import { useQuery } from "@tanstack/react-query";
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreateMatchFlow } from "@/components/create-match-flow";
import { CreateSeasonForm } from "@/components/create-season-form";
import { AddPlayerModal } from "@/components/session/add-player-modal";
import { StartSessionModal } from "@/components/start-session-modal";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

type SubView = "players" | "teams" | "matches" | "session";

const SEASON_SUB_VIEWS: {
	key: SubView;
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
}[] = [
	{
		key: "players",
		label: "Players",
		icon: { ios: "person.2", android: "group", web: "group" },
	},
	{
		key: "teams",
		label: "Teams",
		icon: { ios: "person.3", android: "groups", web: "groups" },
	},
	{
		key: "matches",
		label: "Matches",
		icon: { ios: "sportscourt", android: "sports_soccer", web: "sports_soccer" },
	},
	{ key: "session", label: "Session", icon: { ios: "clock", android: "history", web: "history" } },
];

type SessionTab = "next" | "standings" | "teams";

const SESSION_SUB_VIEWS: {
	key: SessionTab;
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
}[] = [
	{
		key: "next",
		label: "Next Match",
		icon: { ios: "play.circle", android: "play_circle", web: "play_circle" },
	},
	{
		key: "standings",
		label: "Standings",
		icon: { ios: "list.bullet", android: "format_list_bulleted", web: "format_list_bulleted" },
	},
	{
		key: "teams",
		label: "Teams",
		icon: { ios: "person.2", android: "group", web: "group" },
	},
];

interface CreateAction {
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
}

const SEASON_CREATE_ACTIONS: CreateAction[] = [
	{
		label: "Match",
		icon: { ios: "sportscourt", android: "sports_soccer", web: "sports_soccer" },
	},
	{
		label: "Session",
		icon: { ios: "play.fill", android: "play_arrow", web: "play_arrow" },
	},
];

const PLAYER_SUB_VIEWS: {
	key: "enabled" | "disabled";
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
}[] = [
	{ key: "enabled", label: "Enabled", icon: { ios: "person", android: "person", web: "person" } },
	{
		key: "disabled",
		label: "Disabled",
		icon: { ios: "person.slash", android: "person_off", web: "person_off" },
	},
];

const TEAM_SUB_VIEWS: {
	key: "all" | "my";
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
}[] = [
	{
		key: "all",
		label: "All Teams",
		icon: { ios: "person.3", android: "groups", web: "groups" },
	},
	{
		key: "my",
		label: "My Teams",
		icon: { ios: "person.crop.circle", android: "person", web: "person" },
	},
];

export default function AppTabs() {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const pathname = usePathname();
	const params = useGlobalSearchParams<{
		seasonSlug?: string;
		sessionId?: string;
		view?: SubView | SessionTab | "enabled" | "disabled" | "all" | "my";
	}>();
	const [isCreateSeasonOpen, setIsCreateSeasonOpen] = useState(false);
	const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
	const [isStartSessionOpen, setIsStartSessionOpen] = useState(false);
	const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
	const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
	const flyoutProgress = useSharedValue(0);
	const rotation = useSharedValue(0);
	const { data: activeMember } = authClient.useActiveMember();
	const canManage = activeMember?.role === "owner" || activeMember?.role === "editor";
	const trpc = useTRPC();
	const { data: seasonInfo } = useQuery({
		...trpc.season.getBySlug.queryOptions({ seasonSlug: params.seasonSlug ?? "" }),
		enabled: !!params.seasonSlug,
	});
	const is1vNSeason = seasonInfo?.scoreType === "1-v-n-elo";

	const isSessionView = pathname.includes("/session/");
	const isSeasonDetail = pathname.startsWith("/seasons/");
	const isSeasonsList = pathname === "/seasons";
	const isActiveSeason = pathname === "/";
	const isSeasonView = !isSessionView && (isActiveSeason || isSeasonDetail);
	const isLeaguePage =
		pathname === "/teams" ||
		pathname === "/players" ||
		pathname === "/members" ||
		pathname === "/invitations";
	const hasPlus = !(pathname === "/teams" || pathname === "/members");
	const activeView = params.view ?? (isSessionView ? "next" : "players");
	const seasonSlug = params.seasonSlug;
	const sessionId = params.sessionId;

	const goToView = (view: SubView | SessionTab) => {
		if (isSessionView) {
			router.setParams({ view });
		} else if (isSeasonDetail && seasonSlug) {
			router.setParams({ seasonSlug, view });
		} else if (isActiveSeason) {
			router.setParams({ view });
		}
	};

	const homeTab = {
		label: "Home",
		icon: { ios: "house", android: "home", web: "home" } as const,
		active: false,
		onPress: () => router.push("/"),
	};

	let leftTabs: TabProps[] = [];
	let rightTabs: TabProps[] = [];

	if (isSessionView) {
		const subTabs: TabProps[] = SESSION_SUB_VIEWS.map(({ key, label, icon }) => ({
			label,
			icon,
			active: activeView === key,
			onPress: () => goToView(key),
		}));
		leftTabs = subTabs.slice(0, 1);
		rightTabs = subTabs.slice(1);
	} else if (isSeasonView) {
		const subTabs: TabProps[] = SEASON_SUB_VIEWS.filter(
			(v) => !(is1vNSeason && v.key === "session")
		).map(({ key, label, icon }) => ({
			label,
			icon,
			active: activeView === key,
			onPress: () => goToView(key),
		}));
		leftTabs = subTabs.slice(0, 2);
		rightTabs = subTabs.slice(2);
	} else if (pathname === "/players") {
		const playerTabs: TabProps[] = PLAYER_SUB_VIEWS.map(({ key, label, icon }) => ({
			label,
			icon,
			active: activeView === key,
			onPress: () => router.setParams({ view: key }),
		}));
		leftTabs = [homeTab];
		rightTabs = playerTabs;
	} else if (pathname === "/teams") {
		const teamTabs: TabProps[] = TEAM_SUB_VIEWS.map(({ key, label, icon }) => ({
			label,
			icon,
			active: activeView === key,
			onPress: () => router.setParams({ view: key }),
		}));
		leftTabs = [homeTab];
		rightTabs = teamTabs;
	} else if (isSeasonsList || isLeaguePage) {
		leftTabs = [homeTab];
		rightTabs = [];
	}

	const handlePlus = () => {
		if (isSessionView) {
			setIsAddPlayerOpen(true);
		} else if (isSeasonView) {
			setIsFlyoutOpen((open) => !open);
		} else if (isSeasonsList) {
			setIsCreateSeasonOpen(true);
		} else if (pathname === "/teams") {
			Alert.alert("Not supported yet", "Team creation is coming soon.");
		} else if (pathname === "/players") {
			if (canManage) {
				router.push({ pathname: "/players", params: { create: "1" } });
			} else {
				Alert.alert("No access", "Only league editors can add guest players.");
			}
		} else if (pathname === "/members") {
			Alert.alert("Not supported yet", "No create action for members.");
		} else if (pathname === "/invitations") {
			if (canManage) {
				router.push({ pathname: "/invitations", params: { create: "1" } });
			} else {
				Alert.alert("No access", "Only league editors can invite members.");
			}
		} else {
			Alert.alert("Not supported yet", "Match creation is coming soon.");
		}
	};

	const handleFlyoutAction = (label: string) => {
		setIsFlyoutOpen(false);
		if (label === "Match") {
			setIsCreateMatchOpen(true);
			return;
		}
		setIsStartSessionOpen(true);
	};

	useEffect(() => {
		rotation.value = withSpring(isFlyoutOpen ? 1 : 0, { damping: 20, stiffness: 260 });
		flyoutProgress.value = withTiming(isFlyoutOpen ? 1 : 0, { duration: 180 });
	}, [isFlyoutOpen, rotation, flyoutProgress]);

	const plusIconStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value * 45}deg` }],
	}));

	const flyoutPanelStyle = useAnimatedStyle(() => ({
		opacity: flyoutProgress.value,
		transform: [
			{ translateY: (1 - flyoutProgress.value) * 12 },
			{ scale: 0.9 + flyoutProgress.value * 0.1 },
		],
	}));

	return (
		<View
			style={[
				styles.bar,
				{
					backgroundColor: theme.background,
					borderTopColor: theme.border,
					paddingBottom: insets.bottom,
				},
			]}
		>
			{isSeasonView && (
				<View style={styles.flyoutLayer} pointerEvents="box-none">
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Close create menu"
						onPress={() => setIsFlyoutOpen(false)}
						pointerEvents={isFlyoutOpen ? "auto" : "none"}
						style={StyleSheet.absoluteFill}
					/>

					<View style={[styles.flyoutWrap, { bottom: 56 + insets.bottom + 9 }]}>
						<Animated.View
							style={[
								styles.flyout,
								{ backgroundColor: theme.background, borderColor: theme.border },
								flyoutPanelStyle,
							]}
						>
							{SEASON_CREATE_ACTIONS.filter((a) => !(is1vNSeason && a.label === "Session")).map(
								(action, i) => (
									<Pressable
										key={action.label}
										accessibilityRole="button"
										onPress={() => handleFlyoutAction(action.label)}
										style={({ pressed }) => [
											styles.flyoutRow,
											i > 0 && {
												borderTopWidth: StyleSheet.hairlineWidth,
												borderTopColor: theme.border,
											},
											pressed && { backgroundColor: theme.backgroundSelected },
										]}
									>
										<View style={[styles.flyoutIcon, { backgroundColor: theme.glowBlueBg }]}>
											<SymbolView name={action.icon} size={18} tintColor={theme.glowBlueText} />
										</View>
										<ThemedText type="smallBold">{action.label}</ThemedText>
									</Pressable>
								)
							)}
						</Animated.View>
					</View>
				</View>
			)}

			<View style={styles.inner}>
				<View style={styles.side}>
					{leftTabs.map((tab) => (
						<TabButton
							key={tab.label}
							label={tab.label}
							icon={tab.icon}
							active={tab.active}
							tint={theme.text}
							onPress={tab.onPress}
						/>
					))}
				</View>

				<View style={styles.plusSlot}>
					{hasPlus && (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Create"
							accessibilityState={{ expanded: isFlyoutOpen }}
							onPress={handlePlus}
							style={({ pressed }) => [
								styles.plusButton,
								{
									backgroundColor: theme.glowBlueBg,
									borderColor: theme.glowBlueBorder,
								},
								pressed && { opacity: 0.8 },
							]}
						>
							<Animated.View style={plusIconStyle}>
								<SymbolView
									name={{ ios: "plus", android: "add", web: "add" }}
									size={22}
									tintColor={theme.glowBlueText}
								/>
							</Animated.View>
						</Pressable>
					)}
				</View>

				<View style={styles.side}>
					{rightTabs.map((tab) => (
						<TabButton
							key={tab.label}
							label={tab.label}
							icon={tab.icon}
							active={tab.active}
							tint={theme.text}
							onPress={tab.onPress}
						/>
					))}
				</View>
			</View>

			<CreateSeasonForm isOpen={isCreateSeasonOpen} onClose={() => setIsCreateSeasonOpen(false)} />
			{isSeasonView && seasonSlug ? (
				<CreateMatchFlow
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonSlug={seasonSlug}
				/>
			) : null}
			{isSeasonView && seasonSlug ? (
				<StartSessionModal
					isOpen={isStartSessionOpen}
					onClose={() => setIsStartSessionOpen(false)}
					seasonSlug={seasonSlug}
				/>
			) : null}
			{isSessionView && sessionId && seasonSlug ? (
				<AddPlayerModal
					isOpen={isAddPlayerOpen}
					onClose={() => setIsAddPlayerOpen(false)}
					sessionId={sessionId}
					seasonSlug={seasonSlug}
				/>
			) : null}
		</View>
	);
}

interface TabProps {
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
	active: boolean;
	onPress: () => void;
}

function TabButton({
	label,
	icon,
	active,
	tint,
	onPress,
}: {
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
	active: boolean;
	tint: string;
	onPress: () => void;
}) {
	const theme = useTheme();
	const activeTint = theme.glowBlueText;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			onPress={onPress}
			style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
		>
			<SymbolView name={icon} size={22} tintColor={active ? activeTint : tint} />
			<ThemedText type="small" style={{ color: active ? activeTint : tint, fontSize: 11 }}>
				{label}
			</ThemedText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	bar: {
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	inner: {
		flexDirection: "row",
		alignItems: "center",
		height: 50,
	},
	side: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-around",
	},
	tab: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
		paddingVertical: Spacing.two,
		marginHorizontal: Spacing.one,
	},
	plusSlot: {
		width: 56,
		alignItems: "center",
	},
	plusButton: {
		width: 44,
		height: 44,
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
	},
	flyoutLayer: {
		position: "absolute",
		top: -600,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 1,
		alignItems: "center",
	},
	flyoutWrap: {
		position: "absolute",
		bottom: 56,
		alignItems: "center",
	},
	flyout: {
		minWidth: 190,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 0,
		overflow: "hidden",
	},
	flyoutRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.three,
	},
	flyoutIcon: {
		width: 34,
		height: 34,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
});
