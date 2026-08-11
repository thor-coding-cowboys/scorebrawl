import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon } from "@hugeicons/core-free-icons";

const createOneVnSchema = z.object({
	winnerId: z.string().min(1, "Select the winner"),
	playerIds: z.array(z.string()).min(2, "Select at least 2 players"),
});

type CreateOneVnFormValues = z.infer<typeof createOneVnSchema>;

interface CreateOneVnGameDialogProps {
	isOpen: boolean;
	onClose: () => void;
	seasonId: string;
	seasonSlug: string;
}

export function CreateOneVnGameDialog({
	isOpen,
	onClose,
	seasonId,
	seasonSlug,
}: CreateOneVnGameDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: seasonPlayers } = useQuery(
		trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug })
	);

	const {
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<CreateOneVnFormValues>({
		resolver: zodResolver(createOneVnSchema),
		defaultValues: {
			winnerId: "",
			playerIds: [],
		},
	});

	const playerIds = watch("playerIds");
	const winnerId = watch("winnerId");

	const createMutation = useMutation(
		trpc.match.createOneVn.mutationOptions({
			onSuccess: () => {
				toast.success("Game recorded");
				queryClient.invalidateQueries({ queryKey: ["matches", seasonId] });
				queryClient.invalidateQueries({
					queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
				});
				queryClient.invalidateQueries({ queryKey: trpc.match.getLatest.queryKey({ seasonSlug }) });
				reset();
				onClose();
			},
			onError: (err) => {
				toast.error(err instanceof Error ? err.message : "Failed to record game");
			},
		})
	);

	const togglePlayer = (id: string) => {
		const next = playerIds.includes(id) ? playerIds.filter((p) => p !== id) : [...playerIds, id];
		setValue("playerIds", next);
		if (winnerId === id) setValue("winnerId", "");
	};

	const onSubmit = (values: CreateOneVnFormValues) => {
		const loserIds = values.playerIds.filter((id) => id !== values.winnerId);
		createMutation.mutate({
			seasonSlug,
			winnerId: values.winnerId,
			loserIds,
		});
	};

	const selectedPlayers = (seasonPlayers ?? []).filter((p) => playerIds.includes(p.id));

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="sm:max-w-lg max-h-[95vh] overflow-hidden p-0"
				data-testid="create-one-vn-dialog"
			>
				<DialogHeader className="relative z-10 p-4 pb-3 border-b border-border">
					<div className="flex items-center gap-3">
						<div className="w-1.5 h-5 bg-purple-500" />
						<DialogTitle className="text-base font-bold font-mono tracking-tight">
							Record Game
						</DialogTitle>
					</div>
				</DialogHeader>

				<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-80px)] p-4">
					<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
						{/* Players */}
						<div>
							<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
								Players ({playerIds.length})
							</span>
							<div className="flex flex-wrap gap-2 mt-1.5 max-h-40 overflow-y-auto">
								{(seasonPlayers ?? []).map((p) => (
									<button
										key={p.id}
										type="button"
										onClick={() => togglePlayer(p.id)}
										data-testid={`one-vn-player-${p.id}`}
										className={cn(
											"flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-colors",
											playerIds.includes(p.id)
												? "border-purple-500 bg-purple-500/10"
												: "border-border text-muted-foreground"
										)}
									>
										<AvatarWithFallback src={p.image} name={p.name} size="sm" />
										<span className="truncate">{p.name}</span>
									</button>
								))}
							</div>
						</div>

						{/* Winner */}
						<div>
							<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
								Winner
							</span>
							<div className="flex flex-col gap-1.5 mt-1.5">
								{selectedPlayers.map((p) => (
									<label
										key={p.id}
										className={cn(
											"flex items-center gap-2 px-2 py-1.5 rounded-md border cursor-pointer text-sm",
											winnerId === p.id ? "border-purple-500 bg-purple-500/10" : "border-border"
										)}
									>
										<input
											type="radio"
											name="winner"
											value={p.id}
											checked={winnerId === p.id}
											onChange={() => setValue("winnerId", p.id)}
											data-testid={`one-vn-winner-${p.id}`}
										/>
										<AvatarWithFallback src={p.image} name={p.name} size="sm" />
										<span>{p.name}</span>
									</label>
								))}
								{selectedPlayers.length === 0 && (
									<p className="text-xs text-muted-foreground">Select players first</p>
								)}
							</div>
						</div>

						{/* Errors */}
						<div className="min-h-[1.25rem] flex flex-col gap-1">
							{errors.playerIds?.message && (
								<p className="text-destructive text-xs font-mono">{errors.playerIds.message}</p>
							)}
							{errors.winnerId?.message && (
								<p className="text-destructive text-xs font-mono">{errors.winnerId.message}</p>
							)}
							{playerIds.length >= 2 && !winnerId && (
								<div className="flex items-center gap-1.5 text-xs text-amber-600">
									<HugeiconsIcon icon={Alert01Icon} className="size-3.5" />
									Select a winner
								</div>
							)}
						</div>

						<div className="flex gap-4 pt-4 border-t border-border">
							<Button type="button" variant="outline" className="font-mono" onClick={onClose}>
								Cancel
							</Button>
							<GlowButton
								type="submit"
								glowColor={glowColors.blue}
								className="flex-1 font-mono"
								disabled={createMutation.isPending || selectedPlayers.length < 2 || !winnerId}
								data-testid="one-vn-submit-button"
							>
								{createMutation.isPending ? "Recording..." : "Record Game"}
							</GlowButton>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
