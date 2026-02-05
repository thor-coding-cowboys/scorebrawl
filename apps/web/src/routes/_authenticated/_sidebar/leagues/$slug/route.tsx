import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug")({
	component: LeaguesLayout,
	beforeLoad: async ({ params }) => {
		const { data: session } = await authClient.getSession();
		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}

		const { data: organizations } = await authClient.organization.list();
		const org = organizations?.find((o) => o.slug === params.slug);

		if (!org) {
			throw redirect({ to: "/leagues" });
		}

		const currentActiveOrgId = session.session?.activeOrganizationId;
		if (currentActiveOrgId !== org.id) {
			const { error } = await authClient.organization.setActive({
				organizationSlug: params.slug,
			});
			if (error) {
				console.error("Failed to set active organization:", error);
				throw redirect({ to: "/leagues" });
			}
		}
	},
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

function LeaguesLayout() {
	const navigate = useNavigate();
	const { slug } = Route.useLoaderData();

	const { data: session } = authClient.useSession();
	const { data: organizations } = authClient.useListOrganizations();

	useEffect(() => {
		if (slug && organizations && session) {
			const org = organizations.find((o) => o.slug === slug);
			if (!org) {
				const activeOrgId = session.session?.activeOrganizationId;
				const targetOrg = activeOrgId
					? organizations.find((o) => o.id === activeOrgId)
					: organizations[0];

				if (targetOrg) {
					toast.error(`You don't have access to "${slug}". Redirected to "${targetOrg.name}".`, {
						duration: 5000,
					});
					navigate({ to: "/leagues/$slug", params: { slug: targetOrg.slug }, replace: true });
				}
			}
		}
	}, [slug, organizations, session, navigate]);

	return <Outlet />;
}
