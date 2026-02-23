import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft01Icon, GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

const forgotPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
	callbackURL?: string;
}

export function ForgotPasswordForm({ callbackURL }: ForgotPasswordFormProps) {
	const navigate = useNavigate();
	const [isGitHubLoading, setIsGitHubLoading] = useState(false);
	const [apiError, setApiError] = useState<string>("");

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ForgotPasswordFormValues>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: {
			email: "",
		},
	});

	const onSubmit = async (values: ForgotPasswordFormValues) => {
		setApiError("");
		try {
			const { error } = await authClient.requestPasswordReset({
				email: values.email,
				redirectTo: "/auth/reset-password",
			});

			if (error) {
				setApiError(error.message || "Failed to send reset link. Please try again.");
				return;
			}

			toast.success("Password reset link sent to your email");
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
			await authClient.signIn.social({
				provider: "github",
				callbackURL: callbackURL || "/",
			});
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : "Failed to sign in with GitHub. Please try again."
			);
			setIsGitHubLoading(false);
		}
	};

	const handleGoBack = () => {
		navigate({ to: "/auth/sign-in", search: { redirect: callbackURL } });
	};

	return (
		<Card className="w-full max-w-md border-border">
			<CardHeader>
				<CardTitle className="text-2xl">Forgot Password</CardTitle>
				<CardDescription>Enter your email to reset your password</CardDescription>
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
						{apiError && <p className="text-sm text-destructive">{apiError}</p>}
						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting ? "Sending..." : "Send reset link"}
						</Button>
					</FieldGroup>
				</form>

				{import.meta.env.VITE_GITHUB_CLIENT_ID && (
					<>
						<div className="relative my-4">
							<div className="absolute inset-0 flex items-center">
								<Separator />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-card px-2 text-muted-foreground">Or continue with</span>
							</div>
						</div>

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
					</>
				)}

				<Button variant="ghost" className="mt-4 w-full" onClick={handleGoBack} type="button">
					<HugeiconsIcon icon={ArrowLeft01Icon} className="mr-2 h-4 w-4" />
					Go back
				</Button>
			</CardContent>
		</Card>
	);
}
