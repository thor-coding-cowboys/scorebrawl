import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Landing from "@/components/landing";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";
import { fetchSessionForRoute } from "@/hooks/useSession";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
	component: App,
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);

		return { session };
	},
});

function App() {
	const { session } = Route.useRouteContext();

	if (!session) {
		return <Landing />;
	}

	// For authenticated users, check pending invitations first, then organizations
	return <AuthenticatedRedirect session={session} />;
}

function AuthenticatedRedirect({
	session,
}: {
	session: NonNullable<Awaited<ReturnType<typeof authClient.getSession>>["data"]>;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();

	// Check for pending invitations first
	const { data: pendingInvitations, isPending: isPendingInvitations } = useQuery({
		...trpc.member.listPendingInvitations.queryOptions(),
		enabled: !!session,
	});

	// Check organizations
	const { data: organizations, isPending: isPendingOrganizations } =
		authClient.useListOrganizations();

	useEffect(() => {
		// Wait for both queries to finish loading
		if (isPendingInvitations || isPendingOrganizations) return;

		// If user has pending invitations, redirect to the first one
		if (pendingInvitations && pendingInvitations.length > 0) {
			const firstInvitation = pendingInvitations[0];
			void navigate({
				to: "/accept-invitation/$invitationId",
				params: { invitationId: firstInvitation.id },
			});
			return;
		}

		// No pending invitations, check organizations
		if (organizations && organizations.length === 0) {
			void navigate({ to: "/onboarding" });
		} else if (organizations && organizations.length > 0) {
			const activeOrgId = session?.session?.activeOrganizationId;
			const targetOrg = activeOrgId
				? (organizations.find((org) => org.id === activeOrgId) ?? organizations[0])
				: organizations[0];

			if (targetOrg) {
				void navigate({ to: "/leagues/$slug", params: { slug: targetOrg.slug } });
			}
		}
	}, [
		pendingInvitations,
		organizations,
		isPendingInvitations,
		isPendingOrganizations,
		navigate,
		session,
	]);

	return null;
}
