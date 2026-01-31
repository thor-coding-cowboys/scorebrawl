import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Chrome } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  callbackURL?: string;
}

export function ForgotPasswordForm({ callbackURL }: ForgotPasswordFormProps) {
  const navigate = useNavigate();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
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
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSubmitting}
              type="button"
            >
              <Chrome className="mr-2 h-4 w-4" />
              {isGoogleLoading ? "Signing in..." : "Sign in with Google"}
            </Button>
          </>
        )}

        <Button variant="ghost" className="mt-4 w-full" onClick={handleGoBack} type="button">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go back
        </Button>
      </CardContent>
    </Card>
  );
}
