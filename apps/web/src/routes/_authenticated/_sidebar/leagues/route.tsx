import { createFileRoute, Outlet, redirect, useParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues")({
	component: LeaguesLayout,
	beforeLoad: async () => {
		const { data: session } = await authClient.getSession();
		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}
	},
});

function LeaguesLayout() {
	const { slug } = useParams({ from: "/_authenticated/_sidebar/leagues/$slug" });
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: session } = authClient.useSession();
	const { data: organizations } = authClient.useListOrganizations();

	const setActiveMutation = useMutation({
		mutationFn: async (orgSlug: string) => {
			await authClient.organization.setActive({
				organizationSlug: orgSlug,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session"] });
		},
	});

	const handleSetActive = useCallback(
		(orgSlug: string) => {
			setActiveMutation.mutate(orgSlug);
		},
		[setActiveMutation]
	);

	useEffect(() => {
		if (slug && organizations && session && !setActiveMutation.isPending) {
			const org = organizations.find((o) => o.slug === slug);
			if (org) {
				const currentActiveOrgId = session.session?.activeOrganizationId;
				if (currentActiveOrgId !== org.id) {
					handleSetActive(slug);
				}
			} else {
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
	}, [slug, organizations, session, handleSetActive, navigate, setActiveMutation.isPending]);

	return <Outlet />;
}
