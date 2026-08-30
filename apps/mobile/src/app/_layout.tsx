import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import { TRPCProvider, trpcClient } from "@/lib/trpc";

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
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				<QueryClientProvider client={queryClient}>
					<AnimatedSplashOverlay />
					<Stack screenOptions={{ headerShown: false }}>
						<Stack.Screen name="(drawer)" />
						<Stack.Screen name="sign-in" />
						<Stack.Screen name="sign-up" />
						<Stack.Screen name="profile" options={{ headerShown: true, title: "Profile" }} />
					</Stack>
				</QueryClientProvider>
			</TRPCProvider>
		</ThemeProvider>
	);
}
