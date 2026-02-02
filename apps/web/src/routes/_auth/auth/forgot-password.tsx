import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

const authSearchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/_auth/auth/forgot-password")({
	component: RouteComponent,
	validateSearch: zodValidator(authSearchSchema),
});

function RouteComponent() {
	const search = Route.useSearch();

	return <ForgotPasswordForm callbackURL={search.redirect} />;
}
