import { Stack, useNavigation } from "expo-router";

import { HeaderMenuButton } from "@/components/nav/header-buttons";
import { Fonts } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function StackLayout() {
	const theme = useTheme();
	const drawer = useNavigation();

	return (
		<Stack
			screenListeners={{
				state: (e) => {
					const { state } = e.data as { state?: { index: number } };
					drawer.setOptions({ swipeEnabled: (state?.index ?? 0) === 0 });
				},
			}}
			screenOptions={({ navigation, route }) => ({
				headerShown: true,
				headerBackButtonDisplayMode: "minimal",
				headerTintColor: theme.foreground,
				headerStyle: { backgroundColor: theme.background },
				headerTitleStyle: { fontFamily: Fonts.sans, fontSize: 16, fontWeight: "700" },
				contentStyle: { backgroundColor: theme.background },
				headerLeft:
					navigation.getState().routes[0]?.key === route.key
						? () => <HeaderMenuButton />
						: undefined,
			})}
		>
			<Stack.Screen name="index" options={{ title: "" }} />
			<Stack.Screen name="seasons/index" options={{ title: "Seasons" }} />
			<Stack.Screen name="seasons/[seasonSlug]/index" options={{ title: "" }} />
			<Stack.Screen name="seasons/[seasonSlug]/matches" options={{ title: "Matches" }} />
			<Stack.Screen
				name="seasons/[seasonSlug]/session/[sessionId]/index"
				options={{ title: "Session" }}
			/>
			<Stack.Screen
				name="seasons/[seasonSlug]/session/[sessionId]/summary"
				options={{ title: "Session Summary" }}
			/>
			<Stack.Screen name="players/index" options={{ title: "Players" }} />
			<Stack.Screen name="players/[playerId]" options={{ title: "" }} />
			<Stack.Screen name="players/compare" options={{ title: "Compare" }} />
			<Stack.Screen name="teams" options={{ title: "Teams" }} />
			<Stack.Screen name="achievements" options={{ title: "Achievements" }} />
			<Stack.Screen name="members" options={{ title: "Members" }} />
			<Stack.Screen name="invitations" options={{ title: "Invitations" }} />
		</Stack>
	);
}
