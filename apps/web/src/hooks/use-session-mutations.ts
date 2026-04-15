import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { trpcClient, useTRPC } from "@/lib/trpc";
import type { ProposedLineup } from "@/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/session-types";

export function useSessionMutations(
	sessionId: string,
	seasonSlug: string,
	params: { slug: string; seasonSlug: string }
) {
	const queryClient = useQueryClient();
	const trpc = useTRPC();
	const navigate = useNavigate();

	const startNextMatch = useMutation({
		mutationFn: (input: {
			sessionId: string;
			homeSeasonPlayerIds: string[];
			awaySeasonPlayerIds: string[];
		}) => trpcClient.session.startNextMatch.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
		},
		onError: () => toast.error("Failed to start match"),
	});

	const recordResult = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			homeScore: number;
			awayScore: number;
		}) => trpcClient.session.recordResult.mutate(input) as Promise<unknown>,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.match.getLatest.queryKey({ seasonSlug }),
			});
		},
		onError: () => toast.error("Failed to record result"),
	});

	const cancelMatch = useMutation({
		mutationFn: () => trpcClient.session.cancelMatch.mutate({ sessionId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
		},
		onError: () => toast.error("Failed to cancel match"),
	});

	const deleteLastMatch = useMutation({
		mutationFn: () => trpcClient.session.deleteLastMatch.mutate({ sessionId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.match.getLatest.queryKey({ seasonSlug }),
			});
			toast.success("Last match deleted");
		},
		onError: () => toast.error("Failed to delete last match"),
	});

	const addPlayer = useMutation({
		mutationFn: (input: { sessionId: string; seasonPlayerId: string }) =>
			trpcClient.session.addPlayer.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
		},
		onError: () => toast.error("Failed to add player"),
	});

	const removePlayer = useMutation({
		mutationFn: (input: { sessionId: string; sessionPlayerId: string }) =>
			trpcClient.session.removePlayer.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			toast.success("Player removed from session");
		},
		onError: () => toast.error("Failed to remove player"),
	});

	const updateTeamSelection = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			selectedHomePlayerIds: string[];
			selectedAwayPlayerIds: string[];
		}) => trpcClient.session.updateTeamSelection.mutate(input),
	});

	const updateProposedLineup = useMutation({
		mutationFn: (input: {
			sessionId: string;
			proposedLineup: {
				homePlayerIds: string[];
				awayPlayerIds: string[];
				rotatedOut: string[];
				coinTossNeeded: { conflictType: string; candidates: string[] } | null;
				selectedHomePlayerIds: string[];
				selectedAwayPlayerIds: string[];
			};
		}) => trpcClient.session.updateProposedLineup.mutate(input),
	});

	const resolveCoinToss = useMutation({
		mutationFn: (input: { coinTossId: string; resolvedWinnerIds: string[] }) =>
			trpcClient.session.resolveCoinToss.mutate(input) as Promise<{
				resolved: unknown;
				proposedLineup: ProposedLineup;
			}>,
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			void res;
		},
		onError: () => toast.error("Failed to resolve coin toss"),
	});

	const updateMatchScore = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			homeScore: number;
			awayScore: number;
		}) => trpcClient.session.updateMatchScore.mutate(input),
	});

	const endSession = useMutation({
		mutationFn: () => trpcClient.session.end.mutate({ sessionId }),
		onSuccess: () => {
			navigate({
				to: "/leagues/$slug/seasons/$seasonSlug/session/$sessionId/summary",
				params: { slug: params.slug, seasonSlug: params.seasonSlug, sessionId },
			});
		},
		onError: () => toast.error("Failed to end session"),
	});

	return {
		startNextMatch,
		recordResult,
		cancelMatch,
		deleteLastMatch,
		addPlayer,
		removePlayer,
		updateTeamSelection,
		updateProposedLineup,
		resolveCoinToss,
		updateMatchScore,
		endSession,
	};
}
