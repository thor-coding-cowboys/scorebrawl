import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { trpcClient } from "./trpc";

let currentToken: string | null = null;

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

export async function registerForPushNotifications(): Promise<string | null> {
	if (Platform.OS !== "ios" || !Device.isDevice) return null;

	let status = (await Notifications.getPermissionsAsync()).status;
	if (status !== "granted") {
		status = (await Notifications.requestPermissionsAsync()).status;
	}
	if (status !== "granted") return null;

	try {
		const { data: token } = await Notifications.getExpoPushTokenAsync();
		await trpcClient.notification.registerToken.mutate({
			token,
			platform: "ios",
			deviceName: Device.modelName ?? undefined,
		});
		currentToken = token;
		return token;
	} catch (error) {
		console.warn("[Push] Unable to obtain Expo push token", error);
		return null;
	}
}

export async function unregisterPushNotifications(): Promise<void> {
	if (Platform.OS !== "ios" || !currentToken) return;

	try {
		await trpcClient.notification.unregisterToken.mutate({ token: currentToken });
	} catch (error) {
		console.warn("[Push] Unable to unregister push token", error);
	} finally {
		currentToken = null;
	}
}
