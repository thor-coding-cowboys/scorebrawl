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
import { isEmailPasswordEnabled, isGithubEnabled, isGoogleEnabled } from "@/lib/auth-options";

export default function SignUpScreen() {
	const theme = useTheme();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isGithubLoading, setIsGithubLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);

	const onSubmit = async () => {
		setApiError("");
		if (!name || !email || !password) {
			setApiError("Please fill in all fields.");
			return;
		}
		if (password.length < 8) {
			setApiError("Password must be at least 8 characters.");
			return;
		}
		setIsSubmitting(true);
		try {
			const { data, error } = await authClient.signUp.email({
				name,
				email,
				password,
			});

			if (error) {
				setApiError(error.message || "Failed to create account. Please try again.");
				return;
			}

			if (data) {
				const { error: signInError } = await authClient.signIn.email({ email, password });
				if (signInError) {
					router.replace("/sign-in");
					return;
				}
				router.replace("/");
			} else {
				setApiError("Failed to create account. Please try again.");
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

	const hasSocialOptions = isGithubEnabled || isGoogleEnabled;

	return (
		<AuthScreen>
			<Card style={styles.card}>
				<CardHeader>
					<CardTitle>Sign Up</CardTitle>
					<CardDescription>Create your account to get started</CardDescription>
				</CardHeader>
				<CardContent>
					{isEmailPasswordEnabled && (
						<>
							<Input
								label="Name"
								placeholder="Your name"
								value={name}
								onChangeText={(text) => {
									setName(text);
									setApiError("");
								}}
								autoCorrect={false}
								editable={!isSubmitting}
							/>
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
								placeholder="At least 8 characters"
								value={password}
								onChangeText={(text) => {
									setPassword(text);
									setApiError("");
								}}
								secureTextEntry
								textContentType="newPassword"
								editable={!isSubmitting}
							/>
							{apiError ? (
								<ThemedText style={[styles.error, { color: theme.destructive }]}>
									{apiError}
								</ThemedText>
							) : null}
							<Button fullWidth loading={isSubmitting} onPress={onSubmit}>
								{isSubmitting ? "Signing up..." : "Sign Up"}
							</Button>
						</>
					)}

					{hasSocialOptions && (
						<>
							{isEmailPasswordEnabled && <Separator label="Or continue with" />}
							{!isEmailPasswordEnabled && apiError ? (
								<ThemedText style={[styles.error, { color: theme.destructive }]}>
									{apiError}
								</ThemedText>
							) : null}
							<Button
								variant="outline"
								fullWidth
								loading={isGithubLoading}
								disabled={isSubmitting}
								onPress={() => handleSocialSignIn("github")}
							>
								{isGithubLoading ? "Signing in..." : "Sign up with GitHub"}
							</Button>
							<Button
								variant="outline"
								fullWidth
								loading={isGoogleLoading}
								disabled={isSubmitting}
								onPress={() => handleSocialSignIn("google")}
							>
								{isGoogleLoading ? "Signing in..." : "Sign up with Google"}
							</Button>
						</>
					)}

					<ThemedText type="small" style={styles.footer}>
						Already have an account?{" "}
						<Link href="/sign-in" style={{ color: theme.primary }}>
							Sign In
						</Link>
					</ThemedText>
				</CardContent>
			</Card>
		</AuthScreen>
	);
}

const styles = StyleSheet.create({
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
