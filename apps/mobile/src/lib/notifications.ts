import type { QueryClient } from "@tanstack/react-query";
import * as Device from "expo-device";
import type { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { authClient } from "./auth-client";
import { trpcClient } from "./trpc";

const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

let currentToken: string | null = null;
let registration: Promise<string | null> | null = null;

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

async function getToken(): Promise<string> {
	return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
}

async function doRegister(): Promise<string | null> {
	if (Platform.OS !== "ios" || !Device.isDevice) return null;

	try {
		let status = (await Notifications.getPermissionsAsync()).status;
		if (status !== "granted") {
			status = (await Notifications.requestPermissionsAsync()).status;
		}
		if (status !== "granted") return null;

		const token = await getToken();
		await trpcClient.notification.registerToken.mutate({
			token,
			platform: "ios",
			deviceName: Device.modelName ?? undefined,
		});
		currentToken = token;
		return token;
	} catch (error) {
		console.warn("[Push] Unable to register push token", error);
		return null;
	}
}

export function registerForPushNotifications(): Promise<string | null> {
	if (!registration) {
		registration = doRegister().finally(() => {
			registration = null;
		});
	}
	return registration;
}

export async function unregisterPushNotifications(): Promise<void> {
	if (Platform.OS !== "ios") return;
	if (!currentToken && !projectId) return;

	try {
		const token = currentToken ?? (await getToken());
		await trpcClient.notification.unregisterToken.mutate({ token });
		currentToken = null;
	} catch (error) {
		console.warn("[Push] Unable to unregister push token", error);
	}
}

export async function handleNotificationResponse(
	response: Notifications.NotificationResponse,
	router: ReturnType<typeof useRouter>,
	queryClient: QueryClient
): Promise<void> {
	const data = response.notification.request.content.data as Record<string, string> | undefined;
	if (!data?.type) return;

	try {
		if (data.leagueSlug) {
			const { data: organizations } = await authClient.organization.list();
			const organization = organizations?.find((candidate) => candidate.slug === data.leagueSlug);
			if (organization) {
				await authClient.organization.setActive({ organizationId: organization.id });
				await authClient.getSession();
				await queryClient.invalidateQueries();
			}
		}

		switch (data.type) {
			case "session:start":
				if (data.seasonSlug && data.sessionId) {
					router.push({
						pathname: "/seasons/[seasonSlug]/session/[sessionId]",
						params: { seasonSlug: data.seasonSlug, sessionId: data.sessionId },
					});
				}
				break;
			case "match:recorded":
				if (data.seasonSlug) {
					router.push({
						pathname: "/seasons/[seasonSlug]",
						params: { seasonSlug: data.seasonSlug },
					});
				}
				break;
			case "achievement:unlock":
			case "streak":
				if (data.playerId) {
					router.push({ pathname: "/players/[playerId]", params: { playerId: data.playerId } });
				}
				break;
		}
	} catch (error) {
		console.warn("[Push] Unable to handle notification response", error);
	}
}
