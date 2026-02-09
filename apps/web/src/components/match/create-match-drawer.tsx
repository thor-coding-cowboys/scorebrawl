import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Add01Icon,
	Remove01Icon,
	ArrowReloadHorizontalIcon,
	BalanceScaleIcon,
	Tick01Icon,
	UserMultiple02Icon,
	Alert01Icon,
} from "@hugeicons/core-free-icons";

// --- Types ---

interface StandingPlayer {
	id: string;
	seasonId: string;
	playerId: string;
	score: number;
	name: string;
	image: string | null;
	userId: string;
	matchCount: number;
	winCount: number;
	lossCount: number;
	drawCount: number;
}

type PlayerWithSelection = StandingPlayer & { team?: "home" | "away" };

// --- Schema ---

const createMatchSchema = z
	.object({
		homeScore: z.number().int().min(0),
		awayScore: z.number().int().min(0),
		homePlayers: z.array(z.object({ id: z.string() })).min(1, "Select at least 1 home player"),
		awayPlayers: z.array(z.object({ id: z.string() })).min(1, "Select at least 1 away player"),
	})
	.refine((data) => data.homePlayers.length === data.awayPlayers.length, {
		message: "Teams must have equal number of players",
		path: ["homePlayers"], // Show error on home players field
	});

type CreateMatchFormValues = z.infer<typeof createMatchSchema>;

// --- Props ---

interface CreateMatchDialogProps {
	isOpen: boolean;
	onClose: () => void;
	seasonId: string;
	seasonSlug: string;
}

// --- Main Component ---

export function CreateMatchDialog({
	isOpen,
	onClose,
	seasonId,
	seasonSlug,
}: CreateMatchDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: season } = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));

	const { data: seasonPlayers } = useQuery(
		trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug })
	);

	const [teamSelection, setTeamSelection] = useState<PlayerWithSelection[]>([]);
	const [isPlayerDrawerOpen, setIsPlayerDrawerOpen] = useState(false);

	useEffect(() => {
		if (seasonPlayers) {
			setTeamSelection(seasonPlayers.map((p) => ({ ...p })));
		}
	}, [seasonPlayers]);

	const {
		watch,
		setValue,
		handleSubmit,
		reset,
		trigger,
		formState: { errors },
	} = useForm<CreateMatchFormValues>({
		resolver: zodResolver(createMatchSchema),
		defaultValues: {
			homeScore: 0,
			awayScore: 0,
			homePlayers: [],
			awayPlayers: [],
		},
	});

	const homeScore = watch("homeScore");
	const awayScore = watch("awayScore");

	const createMutation = useMutation(
		trpc.match.create.mutationOptions({
			onSuccess: () => {
				toast.success("Match created successfully");
				handleClose();

				// Invalidate match and standings collections (used by custom collection hooks)
				queryClient.invalidateQueries({ queryKey: ["matches", seasonId] });
				queryClient.invalidateQueries({ queryKey: ["standings", seasonId] });

				// Invalidate tRPC queries for dashboard cards and player data
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
			onError: (err) => {
				toast.error(err instanceof Error ? err.message : "Failed to create match");
			},
		})
	);

	const onSubmit = (values: CreateMatchFormValues) => {
		createMutation.mutate({
			seasonSlug,
			homeScore: values.homeScore,
			awayScore: values.awayScore,
			homeTeamPlayerIds: values.homePlayers.map((p) => p.id),
			awayTeamPlayerIds: values.awayPlayers.map((p) => p.id),
		});
	};

	const handlePlayerSelection = (player: PlayerWithSelection) => {
		const updated = teamSelection.map((p) =>
			p.id === player.id ? { ...p, team: player.team } : p
		);
		setTeamSelection(updated);
		setValue(
			"homePlayers",
			updated.filter((p) => p.team === "home").map((p) => ({ id: p.id }))
		);
		setValue(
			"awayPlayers",
			updated.filter((p) => p.team === "away").map((p) => ({ id: p.id }))
		);
		// Use setTimeout to ensure form state is updated before validation
		setTimeout(() => {
			trigger(["homePlayers", "awayPlayers"]);
		}, 0);
	};

	const shuffleTeams = () => {
		const selected = teamSelection.filter((p) => p.team);
		const shuffled = [...selected];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		const half = Math.floor(shuffled.length / 2);
		const homeIds = new Set(shuffled.slice(0, half).map((p) => p.id));
		const awayIds = new Set(shuffled.slice(half).map((p) => p.id));

		const updated = teamSelection.map((p) => ({
			...p,
			team: homeIds.has(p.id)
				? ("home" as const)
				: awayIds.has(p.id)
					? ("away" as const)
					: undefined,
		}));
		setTeamSelection(updated);
		setValue(
			"homePlayers",
			updated.filter((p) => p.team === "home").map((p) => ({ id: p.id }))
		);
		setValue(
			"awayPlayers",
			updated.filter((p) => p.team === "away").map((p) => ({ id: p.id }))
		);
		// Use setTimeout to ensure form state is updated before validation
		setTimeout(() => {
			trigger(["homePlayers", "awayPlayers"]);
		}, 0);
	};

	const evenTeams = () => {
		const selected = teamSelection.filter((p) => p.team);
		const sorted = [...selected].sort((a, b) => b.score - a.score);

		const homeIds = new Set<string>();
		const awayIds = new Set<string>();
		let homeTotal = 0;
		let awayTotal = 0;

		for (const player of sorted) {
			if (homeTotal <= awayTotal) {
				homeIds.add(player.id);
				homeTotal += player.score;
			} else {
				awayIds.add(player.id);
				awayTotal += player.score;
			}
		}

		const updated = teamSelection.map((p) => ({
			...p,
			team: homeIds.has(p.id)
				? ("home" as const)
				: awayIds.has(p.id)
					? ("away" as const)
					: undefined,
		}));
		setTeamSelection(updated);
		setValue(
			"homePlayers",
			updated.filter((p) => p.team === "home").map((p) => ({ id: p.id }))
		);
		setValue(
			"awayPlayers",
			updated.filter((p) => p.team === "away").map((p) => ({ id: p.id }))
		);
		// Use setTimeout to ensure form state is updated before validation
		setTimeout(() => {
			trigger(["homePlayers", "awayPlayers"]);
		}, 0);
	};

	const selectedCount = teamSelection.filter((p) => p.team).length;

	const isSeasonActive = (() => {
		if (!season) return true;
		const now = new Date();
		const start = new Date(season.startDate);
		if (season.endDate) {
			const end = new Date(season.endDate);
			return now >= start && now <= end;
		}
		return now >= start;
	})();

	const homePlayers = teamSelection.filter((p) => p.team === "home");
	const awayPlayers = teamSelection.filter((p) => p.team === "away");
	const canReorder =
		selectedCount > 0 && selectedCount % 2 === 0 && homePlayers.length === awayPlayers.length;

	const handleClose = () => {
		reset();
		setTeamSelection(seasonPlayers ? seasonPlayers.map((p) => ({ ...p })) : []);
		onClose();
	};

	return (
		<>
			<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
				<DialogContent
					className="sm:max-w-lg max-h-[95vh] overflow-hidden p-0 top-8 translate-y-0 data-[state=open]:top-8"
					data-testid="create-match-dialog"
				>
					{/* Decorative grid background */}
					<div className="absolute inset-0 opacity-[0.02]">
						<div
							className="absolute inset-0"
							style={{
								backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
								backgroundSize: "16px 16px",
							}}
						/>
					</div>

					<DialogHeader className="relative z-10 p-4 pb-3 border-b border-border">
						<div className="flex items-center gap-3">
							<div className="w-1.5 h-5 bg-blue-500" />
							<DialogTitle className="text-base font-bold font-mono tracking-tight">
								Create Match
							</DialogTitle>
						</div>
					</DialogHeader>

					<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-80px)] p-4">
						<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
							{/* Score Steppers */}
							<div className="bg-muted/30">
								<div className="grid grid-cols-2">
									<ScoreStepper
										label="Home"
										score={homeScore}
										onIncrement={() => setValue("homeScore", homeScore + 1)}
										onDecrement={() => setValue("homeScore", Math.max(0, homeScore - 1))}
									/>
									<ScoreStepper
										label="Away"
										score={awayScore}
										onIncrement={() => setValue("awayScore", awayScore + 1)}
										onDecrement={() => setValue("awayScore", Math.max(0, awayScore - 1))}
									/>
								</div>
							</div>

							{/* Team Roster Cards */}
							<div className="grid grid-cols-2 gap-4">
								<TeamRosterCard label="Home" players={homePlayers} count={homePlayers.length} />
								<TeamRosterCard label="Away" players={awayPlayers} count={awayPlayers.length} />
							</div>

							{/* Add Players Button */}
							<Button
								type="button"
								variant="outline"
								className="gap-1.5"
								onClick={() => setIsPlayerDrawerOpen(true)}
								data-testid="match-select-players-button"
							>
								<HugeiconsIcon icon={UserMultiple02Icon} className="size-4" />
								Select Players
							</Button>

							{/* Errors & Warnings */}
							<div className="min-h-[1.25rem] flex flex-col gap-1">
								{errors.homePlayers?.message && (
									<p className="text-destructive text-xs font-mono">{errors.homePlayers.message}</p>
								)}
								{errors.awayPlayers?.message && (
									<p className="text-destructive text-xs font-mono">{errors.awayPlayers.message}</p>
								)}
								{errors.root?.message && (
									<p className="text-destructive text-xs font-mono">{errors.root.message}</p>
								)}
								{homePlayers.length !== awayPlayers.length &&
									homePlayers.length > 0 &&
									awayPlayers.length > 0 && (
										<div className="flex items-center gap-1.5 text-xs text-amber-600">
											<HugeiconsIcon icon={Alert01Icon} className="size-3.5" />
											Teams have unequal players ({homePlayers.length} vs {awayPlayers.length})
										</div>
									)}
								{!isSeasonActive && (
									<div className="flex items-center gap-1.5 text-xs text-amber-600">
										<HugeiconsIcon icon={Alert01Icon} className="size-3.5" />
										Season is not currently active
									</div>
								)}
							</div>

							{/* Actions */}
							<div className="flex gap-4 pt-2 border-t border-border">
								<Button
									type="button"
									variant="outline"
									className="font-mono"
									onClick={handleClose}
									data-testid="match-cancel-button"
								>
									Cancel
								</Button>
								<GlowButton
									type="submit"
									glowColor={glowColors.blue}
									className="flex-1 font-mono"
									disabled={createMutation.isPending || homePlayers.length !== awayPlayers.length}
									data-testid="match-submit-button"
								>
									{createMutation.isPending ? "Creating..." : "Create Match"}
								</GlowButton>
							</div>
						</form>
					</div>
				</DialogContent>
			</Dialog>

			{/* Player Selection Drawer */}
			<PlayerSelectionDrawer
				isOpen={isPlayerDrawerOpen}
				onClose={() => setIsPlayerDrawerOpen(false)}
				teamSelection={teamSelection}
				onPlayerSelect={handlePlayerSelection}
				onShuffle={shuffleTeams}
				onEven={evenTeams}
				canReorder={canReorder}
			/>
		</>
	);
}

// --- Score Stepper ---

function ScoreStepper({
	label,
	score,
	onIncrement,
	onDecrement,
}: {
	label: string;
	score: number;
	onIncrement: () => void;
	onDecrement: () => void;
}) {
	const testIdPrefix = `match-${label.toLowerCase()}`;
	return (
		<div className="flex flex-col items-center gap-1 p-4">
			<div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-mono">
				{label}
			</div>
			<div className="flex items-center gap-3">
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					onClick={onDecrement}
					disabled={score <= 0}
					data-testid={`${testIdPrefix}-decrement`}
				>
					<HugeiconsIcon icon={Remove01Icon} className="size-4" />
				</Button>
				<span
					className="text-5xl font-bold tabular-nums tracking-tighter w-16 text-center font-mono"
					data-testid={`${testIdPrefix}-score`}
				>
					{score}
				</span>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					onClick={onIncrement}
					data-testid={`${testIdPrefix}-increment`}
				>
					<HugeiconsIcon icon={Add01Icon} className="size-4" />
				</Button>
			</div>
		</div>
	);
}

// --- Team Roster Card ---

function TeamRosterCard({
	label,
	players,
	count,
}: {
	label: string;
	players: PlayerWithSelection[];
	count: number;
}) {
	const testIdPrefix = `match-${label.toLowerCase()}`;
	return (
		<div className="border border-border" data-testid={`${testIdPrefix}-roster`}>
			<div className="px-3 py-2 border-b border-border bg-muted/30">
				<div className="flex items-center justify-between">
					<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
						{label.toUpperCase()}
					</span>
					<span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
						{count} player{count !== 1 ? "s" : ""}
					</span>
				</div>
			</div>
			<div className="h-32 overflow-y-auto p-2">
				{players.length === 0 ? (
					<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
						No players selected
					</div>
				) : (
					<div className="flex flex-col gap-1">
						{players.map((p) => (
							<div key={p.id} className="flex items-center gap-2 px-1 py-0.5">
								<AvatarWithFallback src={p.image} name={p.name} size="sm" />
								<div className="min-w-0 flex-1">
									<p className="text-xs font-medium truncate">{p.name}</p>
									<p className="text-[0.65rem] text-muted-foreground font-mono">{p.score}</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// --- Player Selection Drawer ---

function PlayerSelectionDrawer({
	isOpen,
	onClose,
	teamSelection,
	onPlayerSelect,
	onShuffle,
	onEven,
	canReorder,
}: {
	isOpen: boolean;
	onClose: () => void;
	teamSelection: PlayerWithSelection[];
	onPlayerSelect: (player: PlayerWithSelection) => void;
	onShuffle: () => void;
	onEven: () => void;
	canReorder: boolean;
}) {
	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DrawerContent className="max-h-[85vh]" data-testid="player-selection-drawer">
				<div className="mx-auto w-full max-w-xl">
					<DrawerHeader className="border-b border-border pb-3">
						<DrawerTitle className="text-sm font-bold font-mono text-center">
							Select Players
						</DrawerTitle>
					</DrawerHeader>

					<div className="grid grid-cols-2 gap-0 max-h-[55vh] overflow-y-auto">
						{/* Home Column */}
						<div className="border-r border-border" data-testid="player-selection-home-column">
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
									Home
								</span>
							</div>
							<PlayerList team="home" players={teamSelection} onSelect={onPlayerSelect} />
						</div>

						{/* Away Column */}
						<div data-testid="player-selection-away-column">
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
									Away
								</span>
							</div>
							<PlayerList team="away" players={teamSelection} onSelect={onPlayerSelect} />
						</div>
					</div>

					<Separator />

					<DrawerFooter className="flex-row items-center justify-between">
						<div className="flex gap-1.5">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!canReorder}
								onClick={onShuffle}
								className="gap-1"
								data-testid="match-shuffle-button"
							>
								<HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-3.5" />
								<span className="hidden sm:inline">Shuffle</span>
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!canReorder}
								onClick={onEven}
								className="gap-1"
								data-testid="match-even-button"
							>
								<HugeiconsIcon icon={BalanceScaleIcon} className="size-3.5" />
								<span className="hidden sm:inline">Even</span>
							</Button>
						</div>
						<GlowButton
							glowColor={glowColors.blue}
							size="sm"
							onClick={onClose}
							icon={Tick01Icon}
							data-testid="match-done-button"
						>
							Done
						</GlowButton>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

// --- Player List (within selection drawer) ---

function PlayerList({
	team,
	players,
	onSelect,
}: {
	team: "home" | "away";
	players: PlayerWithSelection[];
	onSelect: (player: PlayerWithSelection) => void;
}) {
	const handleClick = (player: PlayerWithSelection) => {
		onSelect({
			...player,
			team: player.team === team ? undefined : team,
		});
	};

	return (
		<div className="flex flex-col">
			{players.map((p) => (
				<button
					key={p.id}
					type="button"
					onClick={() => handleClick(p)}
					data-testid={`player-item-${p.id}`}
					className={cn(
						"flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/50 last:border-b-0",
						p.team === team && "bg-primary/10 border-l-2 border-l-primary",
						p.team && p.team !== team && "opacity-40 line-through",
						!p.team && "hover:bg-muted/50"
					)}
				>
					<AvatarWithFallback src={p.image} name={p.name} size="sm" />
					<div className="min-w-0 flex-1">
						<p className="text-xs font-medium truncate">{p.name}</p>
						<p className="text-[0.65rem] text-muted-foreground font-mono">{p.score}</p>
					</div>
					{p.team === team && (
						<HugeiconsIcon icon={Tick01Icon} className="size-3.5 text-primary shrink-0" />
					)}
				</button>
			))}
			{players.length === 0 && (
				<div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
					No players in season
				</div>
			)}
		</div>
	);
}
