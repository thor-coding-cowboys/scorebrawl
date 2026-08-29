import { Drawer } from "expo-router/drawer";
import { useColorScheme } from "react-native";

import { LeagueDrawerContent } from "@/components/league-drawer";
import { AppHeaderLeft } from "@/components/app-header-left";
import { ActiveLeagueTitle } from "@/components/active-league-title";
import { Colors } from "@/constants/theme";

export default function DrawerLayout() {
	const scheme = useColorScheme();
	const colors = Colors[scheme === "unspecified" ? "light" : scheme];

	return (
		<Drawer
			screenOptions={{
				headerLeft: () => <AppHeaderLeft />,
				headerTitle: () => <ActiveLeagueTitle />,
				headerStyle: { backgroundColor: colors.background },
				headerTintColor: colors.text,
				drawerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
			}}
			drawerContent={(props) => <LeagueDrawerContent {...props} />}
		>
			<Drawer.Screen name="(tabs)" options={{ title: "" }} />
		</Drawer>
	);
}
