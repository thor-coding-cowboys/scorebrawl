import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export const SESSION_QUERY_KEY = ["auth", "session"] as const;

/**
 * Custom hook that wraps authClient.getSession with React Query caching
 * This replaces multiple calls to authClient.getSession() with a single cached query
 */
export function useSession() {
	return useQuery({
		queryKey: SESSION_QUERY_KEY,
		queryFn: async () => {
			const { data } = await authClient.getSession();
			return data;
		},
		staleTime: 1000 * 60 * 5, // Consider session data stale after 5 minutes
		gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
		refetchOnWindowFocus: true, // Refetch on window focus to ensure fresh session
		retry: false, // Don't retry session queries to avoid auth loops
	});
}

/**
 * Hook to get session invalidation function for use in mutations
 */
export function useSessionInvalidate() {
	const queryClient = useQueryClient();

	return () => {
		queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
	};
}

/**
 * Fetch session data with QueryClient for use in route loaders
 * This ensures session is cached and doesn't get called multiple times per page load
 */
export async function fetchSessionForRoute(queryClient: QueryClient) {
	return queryClient.fetchQuery({
		queryKey: SESSION_QUERY_KEY,
		queryFn: async () => {
			const { data } = await authClient.getSession();
			return data;
		},
		staleTime: 1000 * 60 * 5, // Same config as useSession hook
		gcTime: 1000 * 60 * 10,
	});
}
