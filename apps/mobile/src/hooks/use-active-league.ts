import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

export function useActiveLeague() {
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const { data: organizations, isPending } = authClient.useListOrganizations();
	const orgs = organizations ?? [];

	const activeOrgId = session?.session?.activeOrganizationId;
	const activeLeague = activeOrgId
		? (orgs.find((org) => org.id === activeOrgId) ?? orgs[0])
		: orgs[0];

	const switchLeague = async (organizationId: string) => {
		const { error } = await authClient.organization.setActive({ organizationId });
		if (error) {
			console.error("Failed to set active league:", error);
			return false;
		}
		await queryClient.invalidateQueries();
		return true;
	};

	return {
		activeLeague,
		organizations,
		isLoading: isPending,
		switchLeague,
	};
}
