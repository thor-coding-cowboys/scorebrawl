import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || "/",
  }),
});

function ForgotPasswordPage() {
  const { redirect } = Route.useSearch();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ForgotPasswordForm callbackURL={redirect} />
    </div>
  );
}
