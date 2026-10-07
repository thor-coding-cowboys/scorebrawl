import { authClient } from "./auth-client";
import { unregisterPushNotifications } from "./notifications";
import { queryClient } from "./query-client";
import { persister } from "./query-persistence";

export async function signOut(): Promise<void> {
	await unregisterPushNotifications();
	await authClient.signOut();
	queryClient.clear();
	await persister.removeClient();
}
