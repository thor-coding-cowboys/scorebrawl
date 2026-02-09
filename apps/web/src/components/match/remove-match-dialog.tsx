import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTRPC, trpcClient } from "@/lib/trpc";
import { queryClient } from "@/lib/query-client";
import { Delete01Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MatchScoreDisplay, type MatchDisplayPlayer } from "./match-score-display";

interface MatchInfo {
	id: string;
	homeScore: number;
	awayScore: number;
	createdAt: Date;
}

interface RemoveMatchDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	matchId: string | null;
	matchInfo?: MatchInfo;
	seasonSlug: string;
	seasonId: string;
}

export function RemoveMatchDialog({
	isOpen,
	onClose,
	onSuccess,
	matchId,
	matchInfo,
	seasonSlug,
	seasonId,
}: RemoveMatchDialogProps) {
	const trpc = useTRPC();
	const [apiError, setApiError] = useState<string>("");

	const { data: matchDetails } = useQuery({
		queryKey: ["match", "details", matchId],
		queryFn: async () => {
			if (!matchId) return null;
			return await trpcClient.match.getById.query({ seasonSlug, matchId });
		},
		enabled: isOpen && !!matchId,
	});

	const homePlayers = (matchDetails?.players?.filter((p: MatchDisplayPlayer) => p.homeTeam) ??
		[]) as MatchDisplayPlayer[];
	const awayPlayers = (matchDetails?.players?.filter((p: MatchDisplayPlayer) => !p.homeTeam) ??
		[]) as MatchDisplayPlayer[];

	const removeMutation = useMutation({
		...trpc.match.remove.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["matches", seasonId] });
			queryClient.invalidateQueries({ queryKey: ["standings", seasonId] });
			queryClient.invalidateQueries({ queryKey: ["team-standings", seasonId] });

			// Invalidate tRPC queries
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getTop.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getAll.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.season.getCountInfo.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({ queryKey: trpc.match.getLatest.queryKey({ seasonSlug }) });
		},
	});

	const handleRemove = async () => {
		setApiError("");
		if (!matchId) return;

		try {
			await removeMutation.mutateAsync({ seasonSlug, matchId });
			toast.success("Match removed successfully");
			onSuccess?.();
			onClose();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to remove match";
			setApiError(message);
			toast.error(message);
		}
	};

	const handleCancel = () => {
		setApiError("");
		onClose();
	};

	if (!matchId) return null;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
			<DialogContent className="sm:max-w-md overflow-hidden" data-testid="remove-match-dialog">
				{/* Technical Grid Background */}
				<div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.02] opacity-[0.05]">
					<div
						className="w-full h-full"
						style={{
							backgroundImage:
								"radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
							backgroundSize: "24px 24px",
						}}
					/>
				</div>

				{/* Header */}
				<DialogHeader className="relative z-10 pb-4 border-b border-border">
					<div className="flex items-center gap-3">
						<div className="w-2 h-6 bg-red-500 rounded-full shadow-lg shadow-red-500/25" />
						<DialogTitle className="text-xl font-bold font-mono tracking-tight">
							Remove Match
						</DialogTitle>
					</div>
				</DialogHeader>

				<div className="relative z-10 space-y-4 py-4">
					{matchInfo && (
						<div className="border border-border rounded-lg p-4 bg-muted/30">
							<MatchScoreDisplay
								matchId={matchInfo.id}
								homeScore={matchInfo.homeScore}
								awayScore={matchInfo.awayScore}
								createdAt={matchInfo.createdAt}
								homePlayers={homePlayers}
								awayPlayers={awayPlayers}
								compact
							/>
						</div>
					)}

					<div className="text-center space-y-2">
						<p className="text-muted-foreground text-sm">
							Are you sure you want to remove this match?
						</p>
					</div>

					<div className="border p-4 space-y-2 bg-red-500/10 border-red-500/20">
						<div className="flex items-start gap-2">
							<HugeiconsIcon
								icon={Alert02Icon}
								className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500"
							/>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">
									This will revert all player and team scores to their previous values. This action
									cannot be undone.
								</p>
							</div>
						</div>
					</div>

					{apiError && (
						<div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
							<p className="text-destructive font-mono text-xs">{apiError}</p>
						</div>
					)}

					<div className="flex gap-3 pt-2">
						<Button
							variant="outline"
							onClick={handleCancel}
							className="flex-1 font-mono h-9 text-sm"
							data-testid="remove-match-cancel-button"
						>
							Cancel
						</Button>
						<Button
							onClick={handleRemove}
							disabled={removeMutation.isPending}
							variant="destructive"
							className="flex-1 font-mono font-bold h-9 text-sm"
							data-testid="remove-match-confirm-button"
						>
							{removeMutation.isPending ? (
								"Removing..."
							) : (
								<>
									<HugeiconsIcon icon={Delete01Icon} className="w-4 h-4 mr-2" />
									Remove Match
								</>
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
