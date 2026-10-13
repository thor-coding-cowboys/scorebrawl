import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchSessionForRoute } from "@/hooks/useSession";
import { ApiKeysPage } from "./-components/api-keys-page";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/api-keys")({
	component: ApiKeysRoute,
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);
		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}
		return { session };
	},
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

function ApiKeysRoute() {
	const { slug } = Route.useLoaderData();
	const navigate = useNavigate();
	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canAccess = role === "owner";

	useEffect(() => {
		if (role && role !== "owner") {
			toast.error("You do not have permission to access API keys. Redirecting...", {
				duration: 3000,
			});
			setTimeout(() => {
				void navigate({ to: "/leagues/$slug", params: { slug } });
			}, 100);
		}
	}, [role, navigate, slug]);

	if (!canAccess) {
		return null;
	}

	return <ApiKeysPage slug={slug} />;
}
