import { zodResolver } from "@hookform/resolvers/zod";
import { GithubIcon, GoogleIcon, Key01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

const signInSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

type SignInFormValues = z.infer<typeof signInSchema>;

interface SignInFormProps {
	callbackURL?: string;
	error?: string;
}

export function SignInForm({ callbackURL, error }: SignInFormProps) {
	const navigate = useNavigate();
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

	// Preload passkeys for conditional UI
	useEffect(() => {
		if (
			typeof PublicKeyCredential === "undefined" ||
			!PublicKeyCredential.isConditionalMediationAvailable
		) {
			return;
		}

		void (async () => {
			const isAvailable = await PublicKeyCredential.isConditionalMediationAvailable();
			setSupportsPasskey(isAvailable);
			if (isAvailable) {
				// Silently handle errors for conditional UI (user might not have passkeys)
				void authClient.signIn.passkey({ autoFill: true }).catch(() => {
					// Ignore errors for conditional UI preload
				});
			}
		})();
	}, []);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignInFormValues>({
		resolver: zodResolver(signInSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const onSubmit = async (values: SignInFormValues) => {
		setApiError("");
		try {
			const { data, error } = await authClient.signIn.email({
				email: values.email,
				password: values.password,
				callbackURL: callbackURL || "/",
			});

			if (error) {
				setApiError(error.message || "Failed to sign in. Please check your credentials.");
				return;
			}

			if (data) {
				navigate({ to: callbackURL || "/" });
			} else {
				setApiError("Failed to sign in. Please try again.");
			}
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
			);
		}
	};

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
						"Passkey sign-in was cancelled. This can happen if you don't have a passkey registered for this account, or if you cancelled the browser prompt. Please sign in with email/password first, then add a passkey in your profile settings.";
				} else if (errorMessage.toLowerCase().includes("not allowed")) {
					displayMessage =
						"Passkey sign-in was not allowed. Please try again or use another sign-in method.";
				} else if (
					errorMessage.toLowerCase().includes("not found") ||
					errorMessage.toLowerCase().includes("no passkey") ||
					errorMessage.toLowerCase().includes("no credential")
				) {
					displayMessage =
						"No passkey found for this account. Please sign in with email/password first, then add a passkey in your profile settings.";
				}

				setApiError(displayMessage || "Failed to sign in with passkey. Please try again.");
				setIsPasskeyLoading(false);
				return;
			}

			if (data) {
				navigate({ to: callbackURL || "/" });
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
					"Passkey sign-in was cancelled. This can happen if you don't have a passkey registered for this account, or if you cancelled the browser prompt. Please sign in with email/password first, then add a passkey in your profile settings.";
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
					"No passkey found for this account. Please sign in with email/password first, then add a passkey in your profile settings.";
			}

			setApiError(displayMessage || "Failed to sign in with passkey. Please try again.");
			setIsPasskeyLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md border-border">
			<CardHeader>
				<CardTitle className="text-2xl">Sign In</CardTitle>
				<CardDescription>Enter your email below to login to your account</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								type="text"
								placeholder="m@example.com"
								autoComplete="username webauthn"
								disabled={isSubmitting}
								{...register("email")}
								onChange={(e) => {
									register("email").onChange(e);
									setApiError("");
								}}
							/>
							{errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
						</Field>
						<Field>
							<div className="flex items-center justify-between">
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Link
									to="/auth/forgot-password"
									search={{ redirect: callbackURL }}
									className="text-sm text-primary hover:underline"
								>
									Forgot your password?
								</Link>
							</div>
							<Input
								id="password"
								type="password"
								placeholder="Password"
								autoComplete="current-password webauthn"
								disabled={isSubmitting}
								{...register("password")}
								onChange={(e) => {
									register("password").onChange(e);
									setApiError("");
								}}
							/>
							{errors.password && (
								<p className="text-sm text-destructive">{errors.password.message}</p>
							)}
						</Field>
						{apiError && <p className="text-sm text-destructive">{apiError}</p>}
						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting ? "Signing in..." : "Sign In"}
						</Button>
					</FieldGroup>
				</form>

				{(import.meta.env.VITE_GITHUB_CLIENT_ID ||
					import.meta.env.VITE_GOOGLE_CLIENT_ID ||
					supportsPasskey) && (
					<>
						<div className="relative my-4">
							<div className="absolute inset-0 flex items-center">
								<Separator />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-card px-2 text-muted-foreground">Or continue with</span>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							{supportsPasskey && (
								<Button
									variant="outline"
									className="w-full"
									onClick={handlePasskeySignIn}
									disabled={isPasskeyLoading || isSubmitting}
									type="button"
								>
									<HugeiconsIcon icon={Key01Icon} className="mr-2 h-4 w-4" />
									{isPasskeyLoading ? "Signing in..." : "Sign in with Passkey"}
								</Button>
							)}
							{import.meta.env.VITE_GITHUB_CLIENT_ID && (
								<Button
									variant="outline"
									className="w-full"
									onClick={handleGitHubSignIn}
									disabled={isGitHubLoading || isSubmitting}
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
									disabled={isGoogleLoading || isSubmitting}
									type="button"
								>
									<HugeiconsIcon icon={GoogleIcon} className="mr-2 h-4 w-4" />
									{isGoogleLoading ? "Signing in..." : "Sign in with Google"}
								</Button>
							)}
						</div>
					</>
				)}

				<div className="mt-4 text-center text-sm text-muted-foreground">
					Don't have an account?{" "}
					<Link
						to="/auth/sign-up"
						search={{ redirect: callbackURL }}
						className="text-primary hover:underline"
					>
						Sign Up
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}
