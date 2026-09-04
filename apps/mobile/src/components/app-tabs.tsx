import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreateSeasonForm } from "@/components/create-season-form";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

type SubView = "standings" | "matches" | "fixtures" | "history";

const SEASON_SUB_VIEWS: {
	key: SubView;
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
}[] = [
	{
		key: "standings",
		label: "Standings",
		icon: { ios: "list.bullet", android: "format_list_bulleted", web: "format_list_bulleted" },
	},
	{
		key: "matches",
		label: "Matches",
		icon: { ios: "sportscourt", android: "sports_soccer", web: "sports_soccer" },
	},
	{
		key: "fixtures",
		label: "Fixtures",
		icon: { ios: "calendar", android: "calendar_month", web: "calendar_month" },
	},
	{ key: "history", label: "History", icon: { ios: "clock", android: "history", web: "history" } },
];

export default function AppTabs() {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const pathname = usePathname();
	const params = useGlobalSearchParams<{ seasonSlug?: string; view?: SubView }>();
	const [isCreateSeasonOpen, setIsCreateSeasonOpen] = useState(false);

	const isSeasonDetail = pathname.startsWith("/seasons/");
	const isSeasonsList = pathname === "/seasons";
	const isActiveSeason = pathname === "/";
	const isSeasonView = isActiveSeason || isSeasonDetail;
	const activeView = params.view ?? "standings";
	const seasonSlug = params.seasonSlug;

	const goToView = (view: SubView) => {
		if (isSeasonDetail && seasonSlug) {
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

	if (isSeasonView) {
		const subTabs: TabProps[] = SEASON_SUB_VIEWS.map(({ key, label, icon }) => ({
			label,
			icon,
			active: activeView === key,
			onPress: () => goToView(key),
		}));
		leftTabs = subTabs.slice(0, 2);
		rightTabs = subTabs.slice(2);
	} else if (isSeasonsList) {
		leftTabs = [homeTab];
		rightTabs = [];
	}

	const handlePlus = () => {
		if (isSeasonsList) {
			setIsCreateSeasonOpen(true);
		} else {
			Alert.alert("Not supported yet", "Match creation is coming soon.");
		}
	};

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
			<View style={styles.inner}>
				<View style={styles.side}>
					{leftTabs.map((tab) => (
						<TabButton
							key={tab.label}
							label={tab.label}
							icon={tab.icon}
							active={tab.active}
							tint={theme.text}
							activeTint={theme.primary}
							onPress={tab.onPress}
						/>
					))}
				</View>

				<View style={styles.plusSlot}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Create"
						onPress={handlePlus}
						style={({ pressed }) => [
							styles.plusButton,
							{ backgroundColor: theme.primary },
							pressed && { opacity: 0.8 },
						]}
					>
						<SymbolView
							name={{ ios: "plus", android: "add", web: "add" }}
							size={22}
							tintColor={theme.primaryForeground}
						/>
					</Pressable>
				</View>

				<View style={styles.side}>
					{rightTabs.map((tab) => (
						<TabButton
							key={tab.label}
							label={tab.label}
							icon={tab.icon}
							active={tab.active}
							tint={theme.text}
							activeTint={theme.primary}
							onPress={tab.onPress}
						/>
					))}
				</View>
			</View>

			<CreateSeasonForm isOpen={isCreateSeasonOpen} onClose={() => setIsCreateSeasonOpen(false)} />
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
	activeTint,
	onPress,
}: {
	label: string;
	icon: Parameters<typeof SymbolView>[0]["name"];
	active: boolean;
	tint: string;
	activeTint: string;
	onPress: () => void;
}) {
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
		height: 56,
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
		gap: 2,
	},
	plusSlot: {
		width: 56,
		alignItems: "center",
	},
	plusButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
	},
});
