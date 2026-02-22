import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	UserIcon,
	UserCheck01Icon,
	UserBlock01Icon,
	UserMultipleIcon,
	Alert02Icon,
	InformationCircleIcon,
	UserAdd01Icon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { RowCard } from "@/components/ui/row-card";
import { useTRPC, trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { GlowButton, glowColors } from "@/components/ui/glow-button";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/players/")({
	component: PlayersPage,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}...`;
}

type Player = {
	id: string;
	name: string | null;
	image: string | null;
	disabled: boolean;
	isGuest: boolean;
	email: string | null;
};

function PlayersPage() {
	const { slug } = Route.useLoaderData();
	const navigate = useNavigate();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
	const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
	const [guestDialogOpen, setGuestDialogOpen] = useState(false);
	const [guestEmail, setGuestEmail] = useState("");
	const [guestDisplayName, setGuestDisplayName] = useState("");
	const [editGuestDialogOpen, setEditGuestDialogOpen] = useState(false);
	const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
	const [editGuestEmail, setEditGuestEmail] = useState("");
	const [editGuestDisplayName, setEditGuestDisplayName] = useState("");

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canManagePlayers = role === "owner" || role === "editor";

	const { data: players, isLoading } = useQuery(trpc.player.getAll.queryOptions());

	const setDisabledMutation = useMutation({
		mutationFn: async ({ playerId, disabled }: { playerId: string; disabled: boolean }) => {
			return trpcClient.player.setDisabled.mutate({ playerId, disabled });
		},
		onSuccess: (_, variables) => {
			toast.success(variables.disabled ? "Player disabled" : "Player enabled");
			void queryClient.invalidateQueries({ queryKey: trpc.player.getAll.queryKey() });
			setConfirmDialogOpen(false);
			setSelectedPlayer(null);
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to update player");
		},
	});

	const createGuestMutation = useMutation({
		mutationFn: async ({ email, displayName }: { email: string; displayName: string }) => {
			return trpcClient.player.createGuestPlayer.mutate({ email, displayName });
		},
		onSuccess: () => {
			toast.success("Guest player added");
			void queryClient.invalidateQueries({ queryKey: trpc.player.getAll.queryKey() });
			void queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey(),
			});
			setGuestDialogOpen(false);
			setGuestEmail("");
			setGuestDisplayName("");
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to add guest player");
		},
	});

	const editGuestMutation = useMutation({
		mutationFn: async ({
			playerId,
			email,
			displayName,
		}: {
			playerId: string;
			email: string;
			displayName: string;
		}) => {
			return trpcClient.player.editGuestPlayer.mutate({ playerId, email, displayName });
		},
		onSuccess: () => {
			toast.success("Guest player updated");
			void queryClient.invalidateQueries({ queryKey: trpc.player.getAll.queryKey() });
			void queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey(),
			});
			setEditGuestDialogOpen(false);
			setEditingPlayer(null);
			setEditGuestEmail("");
			setEditGuestDisplayName("");
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to update guest player");
		},
	});

	const stats = useMemo(() => {
		if (!players) return { total: 0, active: 0, disabled: 0 };
		const total = players.length;
		const disabled = players.filter((p) => p.disabled).length;
		const active = total - disabled;
		return { total, active, disabled };
	}, [players]);

	const openConfirmDialog = (player: Player, e: React.MouseEvent) => {
		e.stopPropagation();
		setSelectedPlayer(player);
		setConfirmDialogOpen(true);
	};

	const handleConfirm = () => {
		if (!selectedPlayer) return;
		setDisabledMutation.mutate({
			playerId: selectedPlayer.id,
			disabled: !selectedPlayer.disabled,
		});
	};

	const handleGuestSubmit = () => {
		createGuestMutation.mutate({ email: guestEmail, displayName: guestDisplayName });
	};

	const openEditGuestDialog = (player: Player, e: React.MouseEvent) => {
		e.stopPropagation();
		setEditingPlayer(player);
		setEditGuestEmail(player.email ?? "");
		setEditGuestDisplayName(player.name ?? "");
		setEditGuestDialogOpen(true);
	};

	const handleEditGuestSubmit = () => {
		if (!editingPlayer) return;
		editGuestMutation.mutate({
			playerId: editingPlayer.id,
			email: editGuestEmail,
			displayName: editGuestDisplayName,
		});
	};

	const isEnabling = selectedPlayer?.disabled ?? false;

	return (
		<>
			{/* Disable/Enable confirm dialog */}
			<Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
				<DialogContent className="sm:max-w-md overflow-hidden">
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

					<DialogHeader className="relative z-10 pb-4 border-b border-border">
						<div className="flex items-center gap-3">
							<div
								className={`w-2 h-6 rounded-full shadow-lg ${isEnabling ? "bg-emerald-500 shadow-emerald-500/25" : "bg-red-500 shadow-red-500/25"}`}
							/>
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								{isEnabling ? "Enable Player" : "Disable Player"}
							</DialogTitle>
						</div>
					</DialogHeader>

					<div className="relative z-10 space-y-4 py-4">
						<div className="flex justify-center">
							<div
								className={`w-16 h-16 rounded-full flex items-center justify-center ${isEnabling ? "bg-emerald-500/10" : "bg-red-500/10"}`}
							>
								<HugeiconsIcon
									icon={isEnabling ? UserCheck01Icon : UserBlock01Icon}
									className={`w-8 h-8 ${isEnabling ? "text-emerald-500" : "text-red-500"}`}
								/>
							</div>
						</div>

						<div className="text-center space-y-2">
							<h3 className="font-mono font-semibold text-lg">
								{isEnabling
									? `Enable ${selectedPlayer?.name ?? "Player"}`
									: `Disable ${selectedPlayer?.name ?? "Player"}`}
							</h3>
							<p className="text-muted-foreground text-sm">
								{isEnabling
									? "Are you sure you want to enable this player?"
									: "Are you sure you want to disable this player?"}
							</p>
						</div>

						<div
							className={`border p-4 space-y-2 ${isEnabling ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}
						>
							<div className="flex items-start gap-2">
								<HugeiconsIcon
									icon={isEnabling ? InformationCircleIcon : Alert02Icon}
									className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isEnabling ? "text-emerald-500" : "text-red-500"}`}
								/>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground">
										{isEnabling
											? "Enabling a player means they will be included in new seasons."
											: "Disabling a player means they will be excluded from new seasons. This does not affect existing seasons."}
									</p>
								</div>
							</div>
						</div>

						<div className="flex gap-3 pt-2">
							<Button
								variant="outline"
								onClick={() => setConfirmDialogOpen(false)}
								className="flex-1 font-mono h-9 text-sm"
							>
								Cancel
							</Button>
							<Button
								onClick={handleConfirm}
								disabled={setDisabledMutation.isPending}
								variant={isEnabling ? "default" : "destructive"}
								className="flex-1 font-mono font-bold h-9 text-sm"
							>
								{setDisabledMutation.isPending ? (
									isEnabling ? (
										"Enabling..."
									) : (
										"Disabling..."
									)
								) : (
									<>
										<HugeiconsIcon
											icon={isEnabling ? UserCheck01Icon : UserBlock01Icon}
											className="w-4 h-4 mr-2"
										/>
										{isEnabling ? "Enable" : "Disable"}
									</>
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Add Guest Player dialog */}
			<Dialog
				open={guestDialogOpen}
				onOpenChange={(open) => {
					setGuestDialogOpen(open);
					if (!open) {
						setGuestEmail("");
						setGuestDisplayName("");
					}
				}}
			>
				<DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden">
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

					<DialogHeader className="relative z-10 pb-4 border-b border-border">
						<div className="flex items-center gap-3">
							<div className="w-2 h-6 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/25" />
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								Add Guest Player
							</DialogTitle>
						</div>
						<DialogDescription className="font-mono text-sm text-muted-foreground">
							Add a player without requiring them to sign up. If they join later, their stats will
							be preserved.
						</DialogDescription>
					</DialogHeader>

					<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)]">
						<div className="space-y-2 p-1">
							<FieldGroup className="space-y-2">
								<Field>
									<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
										Email Address
									</FieldLabel>
									<Input
										id="guest-email"
										type="email"
										placeholder="player@example.com"
										value={guestEmail}
										onChange={(e) => setGuestEmail(e.target.value)}
										className="h-8 font-mono focus:border-emerald-500 focus:ring-emerald-500/20 text-sm"
										required
									/>
									<p className="text-xs text-muted-foreground">
										Required for claiming their profile when they sign up
									</p>
								</Field>

								<Field>
									<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
										Display Name
									</FieldLabel>
									<Input
										id="guest-name"
										placeholder="John Doe"
										value={guestDisplayName}
										onChange={(e) => setGuestDisplayName(e.target.value)}
										className="h-8 font-mono focus:border-emerald-500 focus:ring-emerald-500/20 text-sm"
										required
									/>
									<p className="text-xs text-muted-foreground">
										How they'll appear in matches and leaderboards
									</p>
								</Field>
							</FieldGroup>

							<div className="flex gap-4 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setGuestDialogOpen(false)}
									className="font-mono h-8 text-sm"
								>
									Cancel
								</Button>
								<GlowButton
									glowColor={glowColors.emerald}
									onClick={handleGuestSubmit}
									disabled={createGuestMutation.isPending || !guestEmail || !guestDisplayName}
									className="flex-1 font-mono h-8 text-sm"
								>
									{createGuestMutation.isPending ? "Adding..." : "Add Guest Player"}
								</GlowButton>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit Guest Player dialog */}
			<Dialog
				open={editGuestDialogOpen}
				onOpenChange={(open) => {
					setEditGuestDialogOpen(open);
					if (!open) {
						setEditingPlayer(null);
						setEditGuestEmail("");
						setEditGuestDisplayName("");
					}
				}}
			>
				<DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden">
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

					<DialogHeader className="relative z-10 pb-4 border-b border-border">
						<div className="flex items-center gap-3">
							<div className="w-2 h-6 bg-blue-500 rounded-full shadow-lg shadow-blue-500/25" />
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								Edit Guest Player
							</DialogTitle>
						</div>
						<DialogDescription className="font-mono text-sm text-muted-foreground">
							Update guest player information. Changes only apply to this league.
						</DialogDescription>
					</DialogHeader>

					<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)]">
						<div className="space-y-2 p-1">
							<FieldGroup className="space-y-2">
								<Field>
									<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
										Email Address
									</FieldLabel>
									<Input
										id="edit-guest-email"
										type="email"
										placeholder="player@example.com"
										value={editGuestEmail}
										onChange={(e) => setEditGuestEmail(e.target.value)}
										className="h-8 font-mono focus:border-blue-500 focus:ring-blue-500/20 text-sm"
										required
									/>
									<p className="text-xs text-muted-foreground">
										Required for claiming their profile when they sign up
									</p>
								</Field>

								<Field>
									<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
										Display Name
									</FieldLabel>
									<Input
										id="edit-guest-name"
										placeholder="John Doe"
										value={editGuestDisplayName}
										onChange={(e) => setEditGuestDisplayName(e.target.value)}
										className="h-8 font-mono focus:border-blue-500 focus:ring-blue-500/20 text-sm"
										required
									/>
									<p className="text-xs text-muted-foreground">
										How they'll appear in matches and leaderboards
									</p>
								</Field>
							</FieldGroup>

							<div className="flex gap-4 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setEditGuestDialogOpen(false)}
									className="font-mono h-8 text-sm"
								>
									Cancel
								</Button>
								<GlowButton
									glowColor={glowColors.blue}
									onClick={handleEditGuestSubmit}
									disabled={editGuestMutation.isPending || !editGuestEmail || !editGuestDisplayName}
									className="flex-1 font-mono h-8 text-sm"
								>
									{editGuestMutation.isPending ? "Updating..." : "Update Guest Player"}
								</GlowButton>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Header
				breadcrumbs={[
					{ name: "League", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Players" },
				]}
				rightContent={
					canManagePlayers ? (
						<Button size="sm" className="gap-1.5" onClick={() => setGuestDialogOpen(true)}>
							<HugeiconsIcon icon={UserAdd01Icon} className="size-4" />
							<span className="hidden sm:inline">Add Guest Player</span>
							<span className="sm:hidden">Guest</span>
						</Button>
					) : undefined
				}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="grid gap-3 md:grid-cols-3">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Total Players</CardTitle>
							<HugeiconsIcon icon={UserMultipleIcon} className="size-4 text-blue-500" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.total}</div>
							<p className="text-xs text-muted-foreground">Registered in this league</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Active Players</CardTitle>
							<HugeiconsIcon icon={UserCheck01Icon} className="size-4 text-emerald-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.active}</div>
							<p className="text-xs text-muted-foreground">Included in new seasons</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.08),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Disabled</CardTitle>
							<HugeiconsIcon icon={UserBlock01Icon} className="size-4 text-red-500" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.disabled}</div>
							<p className="text-xs text-muted-foreground">Excluded from new seasons</p>
						</CardContent>
					</Card>
				</div>
				<div className="bg-muted/50 min-h-[100vh] flex-1 md:min-h-min p-6">
					<div className="space-y-4">
						<h3 className="text-lg font-medium">Players</h3>
						{isLoading ? (
							<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
								Loading players...
							</div>
						) : !players || players.length === 0 ? (
							<div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
									<HugeiconsIcon icon={UserIcon} className="size-5" />
								</div>
								No players yet
							</div>
						) : (
							<div className="divide-y divide-border border">
								{players.map((player) => {
									const name = player.name ?? "Unknown";

									return (
										<RowCard
											key={player.id}
											icon={
												<AvatarWithFallback src={player.image} name={name} alt={name} size="lg" />
											}
											title={
												<span className="flex items-center gap-2">
													{name}
													{player.isGuest && (
														<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
															Guest
														</Badge>
													)}
												</span>
											}
											subtitle={
												player.disabled ? (
													<span className="text-red-500">Disabled</span>
												) : (
													<span className="text-emerald-600">Active</span>
												)
											}
											onClick={() =>
												navigate({
													to: "/leagues/$slug/players/$leaguePlayerId",
													params: { slug, leaguePlayerId: player.id },
												})
											}
										>
											{canManagePlayers && (
												<>
													{player.isGuest && (
														<Button
															variant="ghost"
															size="sm"
															className="hover:text-blue-600 hover:bg-blue-500/10"
															onClick={(e) => openEditGuestDialog(player, e)}
															disabled={editGuestMutation.isPending}
														>
															<span className="hidden sm:inline">Edit</span>
															<span className="sm:hidden">
																<HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
															</span>
														</Button>
													)}
													<Button
														variant="ghost"
														size="sm"
														className={
															player.disabled
																? "hover:text-emerald-600"
																: "hover:text-red-500 hover:bg-red-500/10"
														}
														onClick={(e) => openConfirmDialog(player, e)}
														disabled={setDisabledMutation.isPending}
													>
														<span className="hidden sm:inline">
															{player.disabled ? "Enable" : "Disable"}
														</span>
														<span className="sm:hidden">
															<HugeiconsIcon
																icon={player.disabled ? UserCheck01Icon : UserBlock01Icon}
																className="size-4"
															/>
														</span>
													</Button>
												</>
											)}
										</RowCard>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
