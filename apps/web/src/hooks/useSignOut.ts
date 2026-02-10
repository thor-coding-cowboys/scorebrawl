import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

/**
 * Hook to handle sign out with proper cleanup
 * Clears all query cache and navigates to home page
 */
export function useSignOut() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					// Clear all queries to reset app state
					queryClient.clear();
					// Navigate without hard reload
					navigate({ to: "/" });
				},
			},
		});
	};
}
