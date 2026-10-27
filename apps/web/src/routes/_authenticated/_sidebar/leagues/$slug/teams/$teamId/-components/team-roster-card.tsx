import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, UserAdd01Icon, UserRemove01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PlayerAvatarGroupGrid } from "@/components/ui/player-avatar-group";
import { RowCard } from "@/components/ui/row-card";
import { trpcClient, useTRPC, type RouterOutput } from "@/lib/trpc";

type TeamPlayer = RouterOutput["leagueTeam"]["getPlayers"][number];

export function TeamRosterCard({
	teamId,
	players,
	isLoading,
	canManage,
}: {
	teamId: string;
	players: TeamPlayer[] | undefined;
	isLoading: boolean;
	canManage: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [search, setSearch] = useState("");

	const { data: leaguePlayers, isLoading: leaguePlayersLoading } = useQuery({
		...trpc.player.getAll.queryOptions(),
		enabled: canManage && isAddDialogOpen,
	});

	const availablePlayers = useMemo(() => {
		const rosterIds = new Set(players?.map((p) => p.id));
		const term = search.trim().toLowerCase();
		return (leaguePlayers ?? [])
			.filter((p) => !p.disabled && !rosterIds.has(p.id))
			.filter((p) => !term || p.name?.toLowerCase().includes(term))
			.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
	}, [leaguePlayers, players, search]);

	const invalidateRoster = () => {
		void queryClient.invalidateQueries({
			queryKey: trpc.leagueTeam.getPlayers.queryKey({ teamId }),
		});
		void queryClient.invalidateQueries({ queryKey: ["teams"] });
	};

	const addMutation = useMutation({
		mutationFn: async (player: { id: string; name: string | null }) => {
			await trpcClient.leagueTeam.addPlayer.mutate({ teamId, playerId: player.id });
			return player;
		},
		onSuccess: (player) => {
			toast.success(`${player.name ?? "Player"} added to team`);
			invalidateRoster();
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to add player");
		},
	});

	const removeMutation = useMutation({
		mutationFn: async (player: TeamPlayer) => {
			await trpcClient.leagueTeam.removePlayer.mutate({ teamId, playerId: player.id });
			return player;
		},
		onSuccess: (player) => {
			toast.success(`${player.name ?? "Player"} removed from team`);
			invalidateRoster();
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to remove player");
		},
	});

	return (
		<>
			<Dialog
				open={isAddDialogOpen}
				onOpenChange={(open) => {
					setIsAddDialogOpen(open);
					if (!open) setSearch("");
				}}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader className="pb-4 border-b border-border">
						<div className="flex items-center gap-3">
							<div className="w-2 h-6 bg-blue-500 rounded-full" />
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								Add Player
							</DialogTitle>
						</div>
						<DialogDescription className="font-mono text-sm text-muted-foreground">
							Pick a league player to add to this team.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-3">
						<div className="relative">
							<HugeiconsIcon
								icon={Search01Icon}
								className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search players"
								className="pl-8"
								aria-label="Search players"
							/>
						</div>
						<div className="max-h-80 overflow-y-auto divide-y divide-border border">
							{leaguePlayersLoading ? (
								<div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
									Loading players...
								</div>
							) : availablePlayers.length === 0 ? (
								<div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
									No players to add
								</div>
							) : (
								availablePlayers.map((p) => (
									<RowCard
										key={p.id}
										icon={<AvatarWithFallback src={p.image} name={p.name} size="lg" />}
										title={p.name ?? "Unknown"}
										subtitle={p.isGuest ? <span>Guest</span> : null}
										onClick={() => {
											if (!addMutation.isPending) addMutation.mutate(p);
										}}
									>
										<HugeiconsIcon icon={UserAdd01Icon} className="size-4 text-muted-foreground" />
									</RowCard>
								))
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Card>
				<CardHeader className="flex flex-row items-start justify-between gap-2">
					<div className="space-y-1.5">
						<CardTitle>Team Roster</CardTitle>
						<CardDescription>Current team members</CardDescription>
					</div>
					{canManage && (
						<Button size="sm" className="gap-1.5" onClick={() => setIsAddDialogOpen(true)}>
							<HugeiconsIcon icon={UserAdd01Icon} className="size-4" />
							<span className="hidden sm:inline">Add player</span>
						</Button>
					)}
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<PlayerAvatarGroupGrid players={[]} size="xl" isLoading />
					) : !players || players.length === 0 ? (
						<div className="text-center text-muted-foreground py-8">
							No players assigned to this team
						</div>
					) : canManage ? (
						<div className="divide-y divide-border border">
							{players.map((p) => (
								<RowCard
									key={p.id}
									className="cursor-default"
									icon={<AvatarWithFallback src={p.image} name={p.name} size="lg" />}
									title={p.name ?? "Unknown"}
									subtitle={null}
								>
									<Button
										variant="ghost"
										size="sm"
										disabled={removeMutation.isPending}
										onClick={() => removeMutation.mutate(p)}
										aria-label={`Remove ${p.name ?? "player"}`}
									>
										<span className="hidden sm:inline">Remove</span>
										<span className="sm:hidden">
											<HugeiconsIcon icon={UserRemove01Icon} className="size-4" />
										</span>
									</Button>
								</RowCard>
							))}
						</div>
					) : (
						<PlayerAvatarGroupGrid players={players} size="xl" />
					)}
				</CardContent>
			</Card>
		</>
	);
}
