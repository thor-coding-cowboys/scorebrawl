import { Link } from "expo-router";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { AuthScreen } from "@/components/auth-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import {
	isEmailPasswordEnabled,
	isGithubEnabled,
	isGoogleEnabled,
	isPasskeyEnabled,
} from "@/lib/auth-options";

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
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isGithubLoading, setIsGithubLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

	const onSubmit = async () => {
		setApiError("");
		if (!email || !password) {
			setApiError("Please enter your email and password.");
			return;
		}
		setIsSubmitting(true);
		try {
			const { data, error } = await authClient.signIn.email({ email, password });
			if (error) {
				setApiError(error.message || "Failed to sign in. Please check your credentials.");
				return;
			}
			if (data) {
				router.replace("/");
			} else {
				setApiError("Failed to sign in. Please try again.");
			}
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
			);
		} finally {
			setIsSubmitting(false);
		}
	};

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

	const hasPasskeyOption = isPasskeyEnabled;
	const hasAlternateOptions = hasPasskeyOption || isGithubEnabled || isGoogleEnabled;

	return (
		<AuthScreen>
			<Card style={styles.card}>
				<CardHeader>
					<CardTitle>Sign In</CardTitle>
					<CardDescription>
						{isEmailPasswordEnabled
							? "Enter your email below to login to your account"
							: "Sign in to your account"}
					</CardDescription>
				</CardHeader>
				<CardContent style={styles.content}>
					{isEmailPasswordEnabled && (
						<>
							<Input
								label="Email"
								placeholder="m@example.com"
								value={email}
								onChangeText={(text) => {
									setEmail(text);
									setApiError("");
								}}
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType="email-address"
								textContentType="username"
								editable={!isSubmitting}
							/>
							<Input
								label="Password"
								placeholder="Password"
								value={password}
								onChangeText={(text) => {
									setPassword(text);
									setApiError("");
								}}
								secureTextEntry
								textContentType="password"
								editable={!isSubmitting}
							/>
							{apiError ? (
								<ThemedText style={[styles.error, { color: theme.destructive }]}>
									{apiError}
								</ThemedText>
							) : null}
							<Button variant="glow" fullWidth loading={isSubmitting} onPress={onSubmit}>
								{isSubmitting ? "Signing in..." : "Sign In"}
							</Button>
						</>
					)}

					{hasAlternateOptions && (
						<>
							{isEmailPasswordEnabled && <Separator label="Or continue with" />}
							{!isEmailPasswordEnabled && apiError ? (
								<ThemedText style={[styles.error, { color: theme.destructive }]}>
									{apiError}
								</ThemedText>
							) : null}
							{hasPasskeyOption && (
								<Button
									variant="outline"
									fullWidth
									icon={{ ios: "key.fill", android: "key", web: "key" }}
									loading={isPasskeyLoading}
									disabled={isSubmitting}
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
									disabled={isSubmitting}
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
									disabled={isSubmitting}
									onPress={() => handleSocialSignIn("google")}
								>
									{isGoogleLoading ? "Signing in..." : "Sign in with Google"}
								</Button>
							)}
						</>
					)}

					<ThemedText type="small" style={styles.footer}>
						Don't have an account?{" "}
						<Link href="/sign-up" style={{ color: theme.primary }}>
							Sign Up
						</Link>
					</ThemedText>
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
	footer: {
		textAlign: "center",
		marginTop: Spacing.four,
	},
});
