import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { authClient } from "@/lib/auth-client";

SplashScreen.preventAutoHideAsync();

function useProtectedRoute(session: { userId: string } | null, isPending: boolean) {
	const segments = useSegments();
	const router = useRouter();

	useEffect(() => {
		if (isPending) return;

		const isAuthScreen = segments[0] === "sign-in" || segments[0] === "sign-up";

		if (!session && !isAuthScreen) {
			router.replace("/sign-in");
		} else if (session && isAuthScreen) {
			router.replace("/");
		}
	}, [session, segments, isPending, router]);
}

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const { data, isPending } = authClient.useSession();
	const session = data?.session ?? null;

	useProtectedRoute(session, isPending);

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<AnimatedSplashOverlay />
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="sign-in" />
				<Stack.Screen name="sign-up" />
			</Stack>
		</ThemeProvider>
	);
}
