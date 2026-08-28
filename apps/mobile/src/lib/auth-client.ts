import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const AUTH_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://scorebrawl.localhost:1355";

export const authClient = createAuthClient({
	baseURL: AUTH_BASE_URL,
	plugins: [
		expoClient({
			scheme: "scorebrawl",
			storagePrefix: "scorebrawl",
			storage: SecureStore,
		}),
	],
});
