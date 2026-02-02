import { SignInForm } from "@/components/auth/sign-in-form";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-in")({
  component: SignInPage,
  validateSearch: zodValidator(authSearchSchema),
});

function SignInPage() {
  const search = Route.useSearch();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignInForm callbackURL={search.redirect} />
    </div>
  );
}
