import * as SecureStore from "expo-secure-store";

const KEY = "announcer-enabled";

export async function getAnnouncerEnabled(): Promise<boolean> {
	try {
		return (await SecureStore.getItemAsync(KEY)) === "true";
	} catch {
		return false;
	}
}

export async function setAnnouncerEnabled(enabled: boolean): Promise<void> {
	try {
		await SecureStore.setItemAsync(KEY, enabled ? "true" : "false");
	} catch {
		// Best-effort persistence; ignore write failures.
	}
}
