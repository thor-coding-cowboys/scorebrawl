import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Landing from "@/components/landing";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
	component: App,
	beforeLoad: async () => {
		const { data } = await authClient.getSession();

		return { session: data };
	},
});

function App() {
	const { session } = Route.useRouteContext();
	const { data: organizations, isPending } = authClient.useListOrganizations();

	const navigate = useNavigate();

	if (!session) {
		return <Landing />;
	}

	if (isPending) {
		return null;
	}

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

	return null;
}
