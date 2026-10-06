import { Drawer } from "expo-router/drawer";

import { LeagueDrawerContent } from "@/components/league-drawer";
import { AppHeaderLeft } from "@/components/app-header-left";
import { ActiveLeagueTitle } from "@/components/active-league-title";
import { useTheme } from "@/hooks/use-theme";

export default function DrawerLayout() {
	const colors = useTheme();

	return (
		<Drawer
			screenOptions={{
				headerLeft: () => <AppHeaderLeft />,
				headerTitle: () => <ActiveLeagueTitle />,
				headerStyle: { backgroundColor: colors.background },
				headerTintColor: colors.text,
				drawerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
				swipeEnabled: false,
			}}
			drawerContent={(props) => <LeagueDrawerContent {...props} />}
		>
			<Drawer.Screen name="(tabs)" options={{ title: "" }} />
		</Drawer>
	);
}
