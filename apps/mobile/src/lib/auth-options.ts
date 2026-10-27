import { Platform } from "react-native";

export const isGithubEnabled = Boolean(process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID);

export const isGoogleEnabled = Boolean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);

// Android stays hidden until PASSKEY_ANDROID_APK_KEY_HASHES is set on the worker
// and verified on a device; without it every ceremony fails the origin check.
export const isPasskeyEnabled =
	Platform.OS !== "android" && process.env.EXPO_PUBLIC_DISABLE_PASSKEY !== "true";
