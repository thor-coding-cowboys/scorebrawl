import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Landing from "@/components/landing";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
	component: App,
	beforeLoad: async () => {
		const { data } = await authClient.getSession();

		return { session: data };
	},
});

function App() {
	const { session } = Route.useRouteContext();

	if (!session) {
		return <Landing />;
	}

	// For authenticated users, we need to check organizations
	return <OrgRedirect session={session} />;
}

function OrgRedirect({
	session,
}: {
	session: NonNullable<Awaited<ReturnType<typeof authClient.getSession>>["data"]>;
}) {
	const { data: organizations, isPending } = authClient.useListOrganizations();
	const navigate = useNavigate();

	useEffect(() => {
		if (isPending) return;

		if (organizations && organizations.length === 0) {
			navigate({ to: "/onboarding" });
		} else if (organizations && organizations.length > 0) {
			const activeOrgId = session?.session?.activeOrganizationId;
			const targetOrg = activeOrgId
				? organizations.find((org) => org.id === activeOrgId)
				: organizations[0];

			if (targetOrg) {
				navigate({ to: "/leagues/$slug", params: { slug: targetOrg.slug } });
			}
		}
	}, [organizations, isPending, navigate, session]);

	return null;
}
