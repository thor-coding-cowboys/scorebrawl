import { GithubIcon, GoogleIcon, Key01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useSessionInvalidate } from "@/hooks/useSession";

interface SignInFormProps {
	callbackURL?: string;
	error?: string;
}

export function SignInForm({ callbackURL, error }: SignInFormProps) {
	const navigate = useNavigate();
	const invalidateSession = useSessionInvalidate();
	const [isGitHubLoading, setIsGitHubLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
	const [apiError, setApiError] = useState<string>("");
	const [supportsPasskey, setSupportsPasskey] = useState(false);

	// Set error from URL query param
	useEffect(() => {
		if (error) {
			const errorMessages: Record<string, string> = {
				google_auth_failed: "Failed to sign in with Google. Please try again.",
				github_auth_failed: "Failed to sign in with GitHub. Please try again.",
			};
			setApiError(errorMessages[error] || "Authentication failed. Please try again.");
		}
	}, [error]);

	useEffect(() => {
		setSupportsPasskey(typeof PublicKeyCredential !== "undefined");
	}, []);

	const handleGitHubSignIn = async () => {
		setIsGitHubLoading(true);
		setApiError("");
		try {
			const result = await authClient.signIn.social({
				provider: "github",
				callbackURL: callbackURL || "/",
				errorCallbackURL: `/auth/sign-in?error=github_auth_failed&redirect=${encodeURIComponent(callbackURL || "/")}`,
			});
			if (result?.error) {
				const message = result.error.message || "Failed to sign in with GitHub. Please try again.";
				setApiError(message);
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to sign in with GitHub. Please try again.";
			setApiError(message);
		} finally {
			setIsGitHubLoading(false);
		}
	};

	const handleGoogleSignIn = async () => {
		setIsGoogleLoading(true);
		setApiError("");
		try {
			const result = await authClient.signIn.social({
				provider: "google",
				callbackURL: callbackURL || "/",
				errorCallbackURL: `/auth/sign-in?error=google_auth_failed&redirect=${encodeURIComponent(callbackURL || "/")}`,
			});
			if (result?.error) {
				const message = result.error.message || "Failed to sign in with Google. Please try again.";
				setApiError(message);
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to sign in with Google. Please try again.";
			setApiError(message);
		} finally {
			setIsGoogleLoading(false);
		}
	};

	const handlePasskeySignIn = async () => {
		setIsPasskeyLoading(true);
		setApiError("");
		try {
			const { data, error } = await authClient.signIn.passkey({
				autoFill: false,
			});

			if (error) {
				const errorMessage = error.message || "";
				// Provide user-friendly messages for common errors
				let displayMessage = errorMessage;
				if (
					errorMessage.toLowerCase().includes("cancelled") ||
					errorMessage.toLowerCase().includes("abort")
				) {
					displayMessage =
						"Passkey sign-in was cancelled. This can happen if you don't have a passkey registered for this account, or if you cancelled the browser prompt. Please sign in using another method, then add a passkey in your profile settings.";
				} else if (errorMessage.toLowerCase().includes("not allowed")) {
					displayMessage =
						"Passkey sign-in was not allowed. Please try again or use another sign-in method.";
				} else if (
					errorMessage.toLowerCase().includes("not found") ||
					errorMessage.toLowerCase().includes("no passkey") ||
					errorMessage.toLowerCase().includes("no credential")
				) {
					displayMessage =
						"No passkey found for this account. Please sign in using another method, then add a passkey in your profile settings.";
				}

				setApiError(displayMessage || "Failed to sign in with passkey. Please try again.");
				setIsPasskeyLoading(false);
				return;
			}

			if (data) {
				await invalidateSession();
				navigate({ to: callbackURL || "/" } as never);
			} else {
				setApiError("Failed to sign in with passkey. Please try again.");
				setIsPasskeyLoading(false);
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			// Provide user-friendly messages for common errors
			let displayMessage = errorMessage;
			if (
				errorMessage.toLowerCase().includes("cancelled") ||
				errorMessage.toLowerCase().includes("abort") ||
				(err instanceof DOMException && err.name === "AbortError")
			) {
				displayMessage =
					"Passkey sign-in was cancelled. This can happen if you don't have a passkey registered for this account, or if you cancelled the browser prompt. Please sign in using another method, then add a passkey in your profile settings.";
			} else if (
				errorMessage.toLowerCase().includes("not allowed") ||
				(err instanceof DOMException && err.name === "NotAllowedError")
			) {
				displayMessage =
					"Passkey sign-in was not allowed. Please try again or use another sign-in method.";
			} else if (
				errorMessage.toLowerCase().includes("not found") ||
				errorMessage.toLowerCase().includes("no passkey") ||
				errorMessage.toLowerCase().includes("no credential") ||
				(err instanceof DOMException && err.name === "NotFoundError")
			) {
				displayMessage =
					"No passkey found for this account. Please sign in using another method, then add a passkey in your profile settings.";
			}

			setApiError(displayMessage || "Failed to sign in with passkey. Please try again.");
			setIsPasskeyLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md border-border">
			<CardHeader>
				<CardTitle className="text-2xl">Sign In</CardTitle>
				<CardDescription>Sign in to your account</CardDescription>
			</CardHeader>
			<CardContent>
				{apiError && (
					<p className="mb-4 text-sm text-destructive" data-testid="signin-error">
						{apiError}
					</p>
				)}

				<div className="flex flex-col gap-2">
					{import.meta.env.VITE_GITHUB_CLIENT_ID && (
						<Button
							variant="outline"
							className="w-full"
							onClick={handleGitHubSignIn}
							disabled={isGitHubLoading}
							type="button"
						>
							<HugeiconsIcon icon={GithubIcon} className="mr-2 h-4 w-4" />
							{isGitHubLoading ? "Signing in..." : "Sign in with GitHub"}
						</Button>
					)}
					{import.meta.env.VITE_GOOGLE_CLIENT_ID && (
						<Button
							variant="outline"
							className="w-full"
							onClick={handleGoogleSignIn}
							disabled={isGoogleLoading}
							type="button"
						>
							<HugeiconsIcon icon={GoogleIcon} className="mr-2 h-4 w-4" />
							{isGoogleLoading ? "Signing in..." : "Sign in with Google"}
						</Button>
					)}
					{supportsPasskey && (
						<Button
							variant="outline"
							className="w-full"
							onClick={handlePasskeySignIn}
							disabled={isPasskeyLoading}
							type="button"
						>
							<HugeiconsIcon icon={Key01Icon} className="mr-2 h-4 w-4" />
							{isPasskeyLoading ? "Signing in..." : "Sign in with Passkey"}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
