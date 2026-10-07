import { useCallback, useEffect, useMemo, useRef } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { authClient } from "@/lib/auth-client";
import { useOrganizations } from "@/hooks/use-organizations";

export function useActiveLeague() {
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionPending } = authClient.useSession();
	const { data: organizations, isPending } = useOrganizations();
	const orgs = useMemo(() => organizations ?? [], [organizations]);

	const activeOrgId = session?.session?.activeOrganizationId;
	const activeLeague = activeOrgId
		? (orgs.find((org) => org.id === activeOrgId) ?? orgs[0])
		: orgs[0];

	// Ensure the session always has an active league: if the user belongs to
	// leagues but none is set on the session, promote the first (mirrors web).
	const ensuringActiveRef = useRef(false);
	useEffect(() => {
		if (!session || isSessionPending || isPending || orgs.length === 0) return;
		if (activeOrgId && orgs.some((org) => org.id === activeOrgId)) return;
		if (ensuringActiveRef.current) return;
		ensuringActiveRef.current = true;
		void authClient.organization
			.setActive({ organizationId: orgs[0].id })
			.then(async ({ error }) => {
				if (error) {
					console.error("Failed to set active league:", error);
				} else {
					await authClient.getSession();
					void queryClient.invalidateQueries();
				}
			})
			.finally(() => {
				ensuringActiveRef.current = false;
			});
	}, [session, isSessionPending, isPending, orgs, activeOrgId, queryClient]);

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
			// Refresh the auth session so useSession() picks up the new activeOrganizationId
			await authClient.getSession();
			// Mirrors the web app's full invalidateQueries() after organization.setActive;
			// org-scoped queries have no shared key prefix yet.
			await queryClient.invalidateQueries();
			// Reset navigation so the active season is re-resolved for the new league
			// instead of showing the previously selected league's season.
			router.replace("/");
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
