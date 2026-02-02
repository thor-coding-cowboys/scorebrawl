import { SignUpForm } from "@/components/auth/sign-up-form";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUpPage,
  validateSearch: zodValidator(authSearchSchema),
});

function SignUpPage() {
  const search = Route.useSearch();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignUpForm callbackURL={search.redirect} />
    </div>
  );
}
