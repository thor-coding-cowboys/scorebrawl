import * as SecureStore from "expo-secure-store";

function keyFor(leagueId: string) {
	return `last-active-season:${leagueId}`;
}

export async function getLastViewedSeason(leagueId: string): Promise<string | null> {
	try {
		return await SecureStore.getItemAsync(keyFor(leagueId));
	} catch {
		return null;
	}
}

export async function setLastViewedSeason(leagueId: string, slug: string): Promise<void> {
	try {
		await SecureStore.setItemAsync(keyFor(leagueId), slug);
	} catch {
		// Ignore write failures; storage is best-effort.
	}
}