import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { Chrome } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
  callbackURL?: string;
}

export function SignUpForm({ callbackURL }: SignUpFormProps) {
  const navigate = useNavigate();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [apiError, setApiError] = useState<string>("");

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
        callbackURL: callbackURL || "/",
      });

      if (error) {
        setApiError(error.message || "Failed to create account. Please try again.");
        return;
      }

      if (data) {
        navigate({ to: callbackURL || "/" });
      } else {
        setApiError("Failed to create account. Please try again.");
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
