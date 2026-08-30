import { useCallback, useEffect, useMemo, useRef } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

export function useActiveLeague() {
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionPending } = authClient.useSession();
	const { data: organizations, isPending } = authClient.useListOrganizations();
	const orgs = useMemo(() => organizations ?? [], [organizations]);

	const activeOrgId = session?.session?.activeOrganizationId;
	const activeLeague = activeOrgId
		? (orgs.find((org) => org.id === activeOrgId) ?? orgs[0])
		: orgs[0];

	// Ensure the session always has an active league: if the user belongs to
	// leagues but none is set on the session, promote the first (mirrors web).
	const ensuringActiveRef = useRef(false);
	useEffect(() => {
		if (isSessionPending || isPending || orgs.length === 0) return;
		if (activeOrgId && orgs.some((org) => org.id === activeOrgId)) return;
		if (ensuringActiveRef.current) return;
		ensuringActiveRef.current = true;
		void authClient.organization
			.setActive({ organizationId: orgs[0].id })
			.then(({ error }) => {
				if (error) {
					console.error("Failed to set active league:", error);
				} else {
					void queryClient.invalidateQueries();
				}
			})
			.finally(() => {
				ensuringActiveRef.current = false;
			});
	}, [isSessionPending, isPending, orgs, activeOrgId, queryClient]);

	const switchLeague = useCallback(
		async (organizationId: string) => {
			try {
				const { error } = await authClient.organization.setActive({ organizationId });
				if (error) {
					console.error("Failed to set active league:", error);
					return false;
				}
			} catch (err) {
				console.error("Failed to set active league:", err);
				return false;
			}
			// Mirrors the web app's full invalidateQueries() after organization.setActive;
			// org-scoped queries have no shared key prefix yet.
			await queryClient.invalidateQueries();
			return true;
		},
		[queryClient]
	);

	return {
		activeLeague,
		organizations,
		isLoading: isSessionPending || isPending,
		switchLeague,
	};
}
