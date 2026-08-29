import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const AUTH_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://scorebrawl.localhost:1355";

export const authClient = createAuthClient({
	baseURL: AUTH_BASE_URL,
	plugins: [
		expoClient({
			scheme: "scorebrawl",
			storagePrefix: "scorebrawl",
			storage: SecureStore,
		}),
		organizationClient({}),
	],
});

export async function getAuthCookie() {
	if (Platform.OS === "web") return undefined;
	return authClient.getCookie();
}
