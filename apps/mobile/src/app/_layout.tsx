import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { ThemeProvider } from "@/components/theme-provider";
import { useNotificationObserver } from "@/hooks/use-notification-observer";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { authClient } from "@/lib/auth-client";
import { registerForPushNotifications } from "@/lib/notifications";
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

function ThemedNavigationProvider({ children }: { children: ReactNode }) {
	const { themeMode } = useThemeMode();
	const deviceScheme = useColorScheme();
	const resolved =
		themeMode === "system" ? (deviceScheme === "dark" ? "dark" : "light") : themeMode;

	return (
		<NavigationThemeProvider value={resolved === "dark" ? DarkTheme : DefaultTheme}>
			{children}
		</NavigationThemeProvider>
	);
}

function PushNotifications() {
	useNotificationObserver();
	return null;
}

export default function RootLayout() {
	const { data, isPending } = authClient.useSession();
	const session = data?.session ?? null;

	useProtectedRoute(session, isPending);

	const userId = session?.userId ?? null;

	useEffect(() => {
		if (userId) {
			void registerForPushNotifications();
		}
	}, [userId]);

	return (
		<ThemeProvider>
			<ThemedNavigationProvider>
				<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
					<QueryClientProvider client={queryClient}>
						<AnimatedSplashOverlay />
						<PushNotifications />
						<Stack screenOptions={{ headerShown: false }}>
							<Stack.Screen name="(drawer)" />
							<Stack.Screen name="sign-in" />
							<Stack.Screen name="sign-up" />
							<Stack.Screen name="profile" options={{ headerShown: true, title: "Profile" }} />
							<Stack.Screen
								name="settings/notifications"
								options={{ headerShown: true, title: "Notifications" }}
							/>
						</Stack>
					</QueryClientProvider>
				</TRPCProvider>
			</ThemedNavigationProvider>
		</ThemeProvider>
	);
}
