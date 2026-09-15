import { authClient } from "./auth-client";
import { unregisterPushNotifications } from "./notifications";

export async function signOut(): Promise<void> {
	await unregisterPushNotifications();
	await authClient.signOut();
}
