import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { Chrome, Key } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInFormValues = z.infer<typeof signInSchema>;

interface SignInFormProps {
  callbackURL?: string;
}

export function SignInForm({ callbackURL }: SignInFormProps) {
  const navigate = useNavigate();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [apiError, setApiError] = useState<string>("");
  const [supportsPasskey, setSupportsPasskey] = useState(false);

  // Preload passkeys for conditional UI
  useEffect(() => {
    if (!PublicKeyCredential.isConditionalMediationAvailable) {
      return;
    }

    void (async () => {
      const isAvailable = await PublicKeyCredential.isConditionalMediationAvailable();
      setSupportsPasskey(isAvailable);
      // TODO: Re-enable passkey support when better-auth is configured
      // if (isAvailable) {
      // 	// Silently handle errors for conditional UI (user might not have passkeys)
      // 	void authClient.signIn.passkey({ autoFill: true }).catch(() => {
      // 		// Ignore errors for conditional UI preload
      // 	});
      // }
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
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.",
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setApiError("");
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackURL || "/",
      });
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Failed to sign in with Google. Please try again.",
      );
      setIsGoogleLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    // TODO: Re-enable passkey support when better-auth is configured
    setIsPasskeyLoading(true);
    setApiError("Passkey sign-in is not yet configured");
    setIsPasskeyLoading(false);
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
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Link
                  to="/auth/forgot-password"
                  search={{ redirect: callbackURL || "/" }}
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

        {(import.meta.env.VITE_GOOGLE_CLIENT_ID || supportsPasskey) && (
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
                  <Key className="mr-2 h-4 w-4" />
                  {isPasskeyLoading ? "Signing in..." : "Sign in with Passkey"}
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
                  <Chrome className="mr-2 h-4 w-4" />
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
