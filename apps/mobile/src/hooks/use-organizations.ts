import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

export function useOrganizations() {
	const { data: session } = authClient.useSession();
	const userId = session?.user.id;

	return useQuery({
		queryKey: ["auth", "organizations", userId],
		queryFn: async () => {
			const { data, error } = await authClient.organization.list();
			if (error) throw new Error(error.message ?? "Failed to load organizations");
			return data ?? [];
		},
		enabled: Boolean(userId),
	});
}
