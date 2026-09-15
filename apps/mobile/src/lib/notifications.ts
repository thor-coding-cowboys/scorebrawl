import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
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
