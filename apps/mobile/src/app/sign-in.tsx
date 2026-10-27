import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { AuthScreen } from "@/components/auth-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { isGithubEnabled, isGoogleEnabled, isPasskeyEnabled } from "@/lib/auth-options";

// Client-side ceremony failures all carry the message "Auth cancelled", so only
// the error code tells a real cancel apart from a missing or refused credential.
function passkeyErrorMessage(error: { code?: string; message?: string }) {
	switch (error.code) {
		case "ERROR_CEREMONY_ABORTED":
			return "Passkey sign-in was cancelled. If you have no passkey for this account, sign in another way, then add one from your profile.";
		case "PASSKEY_NOT_FOUND":
			return "This passkey is no longer linked to an account. Sign in another way, then add a new one from your profile.";
		case "AUTH_CANCELLED":
			return "Passkey sign-in didn't complete. Try again, or sign in another way and add a passkey from your profile.";
		default:
			return error.message || "Failed to sign in with passkey. Please try again.";
	}
}

export default function SignInScreen() {
	const theme = useTheme();
	const [apiError, setApiError] = useState("");
	const [isGithubLoading, setIsGithubLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

	const handleSocialSignIn = async (provider: "github" | "google") => {
		setApiError("");
		const setLoading = provider === "github" ? setIsGithubLoading : setIsGoogleLoading;
		setLoading(true);
		try {
			const { error } = await authClient.signIn.social({ provider, callbackURL: "/" });
			if (error) {
				setApiError(error.message || `Failed to sign in with ${provider}. Please try again.`);
			}
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : `Failed to sign in with ${provider}. Please try again.`
			);
		} finally {
			setLoading(false);
		}
	};

	const handlePasskeySignIn = async () => {
		setApiError("");
		setIsPasskeyLoading(true);
		try {
			const { data, error } = await authClient.signIn.passkey();
			if (error) {
				setApiError(passkeyErrorMessage(error));
				return;
			}
			if (!data) {
				setApiError("Failed to sign in with passkey. Please try again.");
				return;
			}
			await authClient.getSession();
			router.replace("/");
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : "Failed to sign in with passkey. Please try again."
			);
		} finally {
			setIsPasskeyLoading(false);
		}
	};

	return (
		<AuthScreen>
			<Card style={styles.card}>
				<CardHeader>
					<CardTitle>Sign In</CardTitle>
					<CardDescription>Sign in to your account</CardDescription>
				</CardHeader>
				<CardContent style={styles.content}>
					{apiError ? (
						<ThemedText style={[styles.error, { color: theme.destructive }]}>{apiError}</ThemedText>
					) : null}

					{isPasskeyEnabled && (
						<Button
							variant="outline"
							fullWidth
							icon={{ ios: "key.fill", android: "key", web: "key" }}
							loading={isPasskeyLoading}
							onPress={handlePasskeySignIn}
						>
							{isPasskeyLoading ? "Signing in..." : "Sign in with Passkey"}
						</Button>
					)}
					{isGithubEnabled && (
						<Button
							variant="outline"
							fullWidth
							loading={isGithubLoading}
							onPress={() => handleSocialSignIn("github")}
						>
							{isGithubLoading ? "Signing in..." : "Sign in with GitHub"}
						</Button>
					)}
					{isGoogleEnabled && (
						<Button
							variant="outline"
							fullWidth
							loading={isGoogleLoading}
							onPress={() => handleSocialSignIn("google")}
						>
							{isGoogleLoading ? "Signing in..." : "Sign in with Google"}
						</Button>
					)}
				</CardContent>
			</Card>
		</AuthScreen>
	);
}

const styles = StyleSheet.create({
	content: {
		gap: Spacing.three,
	},
	card: {
		maxWidth: 448,
	},
	error: {
		fontSize: 14,
		lineHeight: 20,
	},
});
