import { zodResolver } from "@hookform/resolvers/zod";
import { GithubIcon, GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";

const signUpSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
	callbackURL?: string;
	error?: string;
}

export function SignUpForm({ callbackURL, error }: SignUpFormProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isGitHubLoading, setIsGitHubLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [apiError, setApiError] = useState<string>("");

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

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignUpFormValues>({
		resolver: zodResolver(signUpSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
		},
	});

	const onSubmit = async (values: SignUpFormValues) => {
		setApiError("");
		try {
			const { data, error } = await authClient.signUp.email({
				name: values.name,
				email: values.email,
				password: values.password,
			});

			if (error) {
				setApiError(error.message || "Failed to create account. Please try again.");
				return;
			}

			if (data) {
				// Auto sign-in after successful sign-up
				const { error: signInError } = await authClient.signIn.email({
					email: values.email,
					password: values.password,
				});

				if (signInError) {
					// If auto sign-in fails, redirect to sign-in page
					void navigate({
						to: "/auth/sign-in",
						search: { redirect: callbackURL },
					});
					return;
				}

				// Invalidate session cache to ensure fresh data
				void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

				// Successfully signed in, redirect to callback URL
				void navigate({ to: callbackURL || "/" });
			} else {
				setApiError("Failed to create account. Please try again.");
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
				errorCallbackURL: `/auth/sign-up?error=github_auth_failed&redirect=${encodeURIComponent(callbackURL || "/")}`,
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
				errorCallbackURL: `/auth/sign-up?error=google_auth_failed&redirect=${encodeURIComponent(callbackURL || "/")}`,
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

	return (
		<Card className="w-full max-w-md border-border">
			<CardHeader>
				<CardTitle className="text-2xl">Sign Up</CardTitle>
				<CardDescription>Enter your information to create an account</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="name">Name</FieldLabel>
							<Input
								id="name"
								type="text"
								placeholder="Name"
								disabled={isSubmitting}
								{...register("name")}
								onChange={(e) => {
									register("name").onChange(e);
									setApiError("");
								}}
							/>
							{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
						</Field>
						<Field>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								type="text"
								placeholder="m@example.com"
								autoComplete="email"
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
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								type="password"
								placeholder="Password"
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
							{isSubmitting ? "Creating account..." : "Create an account"}
						</Button>
					</FieldGroup>
				</form>

				{(import.meta.env.VITE_GITHUB_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID) && (
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
							{import.meta.env.VITE_GITHUB_CLIENT_ID && (
								<Button
									variant="outline"
									className="w-full"
									onClick={handleGitHubSignIn}
									disabled={isGitHubLoading || isSubmitting}
									type="button"
								>
									<HugeiconsIcon icon={GithubIcon} className="mr-2 h-4 w-4" />
									{isGitHubLoading ? "Signing in..." : "Sign up with GitHub"}
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
									{isGoogleLoading ? "Signing in..." : "Sign up with Google"}
								</Button>
							)}
						</div>
					</>
				)}

				<div className="mt-4 text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link
						to="/auth/sign-in"
						search={{ redirect: callbackURL }}
						className="text-primary hover:underline"
					>
						Sign In
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}
