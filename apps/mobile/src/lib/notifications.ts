import type { QueryClient } from "@tanstack/react-query";
import type { NotificationPayload } from "@coding-cowboys/scorebrawl-worker/services/notification-payload";
import * as Device from "expo-device";
import type { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { authClient } from "./auth-client";
import { trpcClient } from "./trpc";

const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const TOKEN_STORAGE_KEY = "scorebrawl.pushToken";

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
		await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
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

	const storedToken = currentToken ?? (await SecureStore.getItemAsync(TOKEN_STORAGE_KEY));
	if (!storedToken && !projectId) return;

	try {
		const token = storedToken ?? (await getToken());
		await trpcClient.notification.unregisterToken.mutate({ token });
		currentToken = null;
		await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
	} catch (error) {
		console.warn("[Push] Unable to unregister push token", error);
	}
}

function parseNotificationPayload(value: unknown): NotificationPayload | null {
	if (typeof value !== "object" || value === null) return null;

	const record = value as Record<string, unknown>;
	const leagueSlug = typeof record.leagueSlug === "string" ? record.leagueSlug : null;
	const seasonSlug = typeof record.seasonSlug === "string" ? record.seasonSlug : null;

	switch (record.type) {
		case "session:start": {
			const sessionId = typeof record.sessionId === "string" ? record.sessionId : null;
			if (!leagueSlug || !seasonSlug || !sessionId) return null;
			return { type: "session:start", leagueSlug, seasonSlug, sessionId };
		}
		case "match:recorded": {
			const matchId = typeof record.matchId === "string" ? record.matchId : null;
			if (!leagueSlug || !seasonSlug || !matchId) return null;
			return { type: "match:recorded", leagueSlug, seasonSlug, matchId };
		}
		case "achievement:unlock":
		case "streak": {
			const playerId = typeof record.playerId === "string" ? record.playerId : null;
			if (!leagueSlug || !seasonSlug || !playerId) return null;
			return { type: record.type, leagueSlug, seasonSlug, playerId };
		}
		default:
			return null;
	}
}

export async function handleNotificationResponse(
	response: Notifications.NotificationResponse,
	router: ReturnType<typeof useRouter>,
	queryClient: QueryClient
): Promise<void> {
	const payload = parseNotificationPayload(response.notification.request.content.data);
	if (!payload) return;

	try {
		const { data: organizations } = await authClient.organization.list();
		const organization = organizations?.find((candidate) => candidate.slug === payload.leagueSlug);
		if (!organization) return;

		await authClient.organization.setActive({ organizationId: organization.id });
		await authClient.getSession();
		await queryClient.invalidateQueries();

		switch (payload.type) {
			case "session:start":
				router.push({
					pathname: "/seasons/[seasonSlug]/session/[sessionId]",
					params: { seasonSlug: payload.seasonSlug, sessionId: payload.sessionId },
				});
				break;
			case "match:recorded":
				router.push({
					pathname: "/seasons/[seasonSlug]",
					params: { seasonSlug: payload.seasonSlug },
				});
				break;
			case "achievement:unlock":
			case "streak":
				router.push({ pathname: "/players/[playerId]", params: { playerId: payload.playerId } });
				break;
		}
	} catch (error) {
		console.warn("[Push] Unable to handle notification response", error);
	}
}
