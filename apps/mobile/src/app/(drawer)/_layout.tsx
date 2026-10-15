import { Drawer } from "expo-router/drawer";

import { LeagueDrawerContent } from "@/components/league-drawer";
import { useTheme } from "@/hooks/use-theme";
import { SharedColors } from "@/constants/theme";

export default function DrawerLayout() {
	const colors = useTheme();

	return (
		<Drawer
			screenOptions={{
				headerShown: false,
				drawerType: "slide",
				drawerStyle: { backgroundColor: colors.background, width: 300 },
				overlayColor: SharedColors.overlay,
				swipeEdgeWidth: 48,
			}}
			drawerContent={(props) => <LeagueDrawerContent {...props} />}
		>
			<Drawer.Screen name="(stack)" />
		</Drawer>
	);
}
