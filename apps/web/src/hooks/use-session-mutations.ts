import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trpcClient, type AnyTRPC } from "@/lib/trpc";
import { toast } from "sonner";

export function useSessionMutations(sessionId: string) {
	const queryClient = useQueryClient();
	const client = trpcClient as AnyTRPC;

	const invalidateSession = () => {
		queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
	};

	const startNextMatch = useMutation({
		mutationFn: (input: { homeSeasonPlayerIds: string[]; awaySeasonPlayerIds: string[] }) =>
			client.session.startNextMatch.mutate({ sessionId, ...input }) as Promise<unknown>,
		onSuccess: invalidateSession,
		onError: () => toast.error("Failed to start match"),
	});

	const recordResult = useMutation({
		mutationFn: (input: { sessionMatchId: string; homeScore: number; awayScore: number }) =>
			client.session.recordResult.mutate({ sessionId, ...input }) as Promise<unknown>,
		onSuccess: invalidateSession,
		onError: () => toast.error("Failed to record result"),
	});

	const cancelMatch = useMutation({
		mutationFn: () => client.session.cancelMatch.mutate({ sessionId }) as Promise<unknown>,
		onSuccess: invalidateSession,
		onError: () => toast.error("Failed to cancel match"),
	});

	const deleteLastMatch = useMutation({
		mutationFn: () => client.session.deleteLastMatch.mutate({ sessionId }) as Promise<unknown>,
		onSuccess: () => {
			invalidateSession();
			toast.success("Last match deleted");
		},
		onError: () => toast.error("Failed to delete last match"),
	});

	const updateMatchScore = useMutation({
		mutationFn: (input: { sessionMatchId: string; homeScore: number; awayScore: number }) =>
			client.session.updateMatchScore.mutate({ sessionId, ...input }) as Promise<unknown>,
	});

	const endSession = useMutation({
		mutationFn: () => client.session.end.mutate({ sessionId }) as Promise<unknown>,
		onSuccess: invalidateSession,
		onError: () => toast.error("Failed to end session"),
	});

	return {
		startNextMatch,
		recordResult,
		cancelMatch,
		deleteLastMatch,
		updateMatchScore,
		endSession,
	};
}
