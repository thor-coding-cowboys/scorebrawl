import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	PlayerAvatarGroupInline,
	PlayerAvatarGroupGrid,
} from "@/components/ui/player-avatar-group";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoUpload } from "@/components/ui/logo-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { truncateSlug } from "@/lib/utils";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Target01Icon,
	Award01Icon,
	UserMultiple02Icon,
	Calendar01Icon,
	ArrowUp01Icon,
	ArrowDown01Icon,
	UserMultipleIcon,
	ChartIcon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from "recharts";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	type ChartConfig,
} from "@/components/ui/chart";

const teamSearchSchema = z.object({
	season: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/teams/$teamId/")({
	component: TeamProfilePage,
	validateSearch: teamSearchSchema,
	loader: async ({ params }) => {
		return { slug: params.slug, teamId: params.teamId };
	},
});

// Helper to construct asset URL from key
const getAssetUrl = (key: string | null | undefined): string | null => {
	if (!key) return null;
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return key;
	}
	return `/api/user-assets/${key}`;
};

const seasonHistoryConfig = {
	score: {
		label: "Final Score",
		color: "var(--chart-1)",
	},
	winRate: {
		label: "Win Rate %",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

const matchResultsConfig = {
	wins: {
		label: "Wins",
		color: "#22c55e",
	},
	losses: {
		label: "Losses",
		color: "#ef4444",
	},
	draws: {
		label: "Draws",
		color: "#6b7280",
	},
} satisfies ChartConfig;

function TeamProfilePage() {
	const { slug, teamId } = Route.useLoaderData();
	const navigate = useNavigate({ from: Route.fullPath });
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [editName, setEditName] = useState("");
	const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const [isLogoRemoved, setIsLogoRemoved] = useState(false);

	const { season: selectedSeasonId } = Route.useSearch();
	const setSelectedSeasonId = (id: string | undefined) => {
		navigate({ to: ".", search: (prev) => ({ ...prev, season: id }) });
	};

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const isEditor = role === "owner" || role === "admin" || role === "editor";

	const { data: userSession } = authClient.useSession();
	const currentUserId = userSession?.user?.id;

	// Get available seasons
	const { data: seasons } = useQuery(trpc.season.getAll.queryOptions());

	const {
		data: team,
		isLoading: teamLoading,
		error: teamError,
	} = useQuery(trpc.leagueTeam.getById.queryOptions({ teamId }));

	const { data: players, isLoading: playersLoading } = useQuery(
		trpc.leagueTeam.getPlayers.queryOptions({ teamId })
	);

	const { data: allTimeStats, isLoading: allTimeStatsLoading } = useQuery(
		trpc.leagueTeam.getAllTimeStats.queryOptions({
			teamId,
			seasonId: selectedSeasonId,
		})
	);

	const { data: bestSeason, isLoading: bestSeasonLoading } = useQuery({
		...trpc.leagueTeam.getBestSeason.queryOptions({
			teamId,
			seasonId: selectedSeasonId,
		}),
		enabled: !selectedSeasonId,
	});

	const { data: filteredSeason, isLoading: filteredSeasonLoading } = useQuery({
		...trpc.leagueTeam.getBestSeason.queryOptions({
			teamId,
			seasonId: selectedSeasonId,
		}),
		enabled: !!selectedSeasonId,
	});

	const { data: seasonHistory, isLoading: seasonHistoryLoading } = useQuery(
		trpc.leagueTeam.getSeasonHistory.queryOptions({ teamId })
	);

	const { data: recentMatches, isLoading: matchesLoading } = useQuery(
		trpc.leagueTeam.getRecentMatches.queryOptions({
			teamId,
			limit: 10,
			seasonId: selectedSeasonId,
		})
	);

	const {
		data: rivalTeams,
		isLoading: rivalsLoading,
		error: rivalsError,
	} = useQuery({
		...trpc.leagueTeam.getRivalTeams.queryOptions({
			teamId,
			seasonId: selectedSeasonId,
		}),
		enabled: !!teamId && !!team,
		retry: 2,
		retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	const canEdit =
		isEditor || (!!currentUserId && !!players?.some((p) => p.userId === currentUserId));

	const editMutation = useMutation({
		mutationFn: async ({ name }: { name: string }) => {
			return await trpcClient.leagueTeam.edit.mutate({ teamId, name });
		},
		onSuccess: () => {
			toast.success("Team updated");
			void queryClient.invalidateQueries({
				queryKey: trpc.leagueTeam.getById.queryKey({ teamId }),
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to update team");
		},
	});

	const uploadLogoMutation = useMutation({
		mutationFn: async ({ imageData }: { imageData: string }) => {
			return await trpcClient.leagueTeam.uploadLogo.mutate({ teamId, imageData });
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: trpc.leagueTeam.getById.queryKey({ teamId }),
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to upload logo");
		},
	});

	const deleteLogoMutation = useMutation({
		mutationFn: async () => {
			return await trpcClient.leagueTeam.deleteLogo.mutate({ teamId });
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: trpc.leagueTeam.getById.queryKey({ teamId }),
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to remove logo");
		},
	});

	const isSaving =
		editMutation.isPending || uploadLogoMutation.isPending || deleteLogoMutation.isPending;

	const openEditDialog = () => {
		if (!team) return;
		setEditName(team.name);
		setLogoPreview(getAssetUrl(team.logo));
		setSelectedLogo(null);
		setIsLogoRemoved(false);
		setIsEditDialogOpen(true);
	};

	const closeEditDialog = () => {
		if (logoPreview?.startsWith("blob:")) {
			URL.revokeObjectURL(logoPreview);
		}
		setIsEditDialogOpen(false);
		setEditName("");
		setSelectedLogo(null);
		setLogoPreview(null);
		setIsLogoRemoved(false);
	};

	const handleFileSelect = (file: File) => {
		setSelectedLogo(file);
		const previewUrl = URL.createObjectURL(file);
		setLogoPreview(previewUrl);
		setIsLogoRemoved(false);
	};

	const handleRemoveLogo = () => {
		if (logoPreview?.startsWith("blob:")) {
			URL.revokeObjectURL(logoPreview);
		}
		setSelectedLogo(null);
		setLogoPreview(null);
		setIsLogoRemoved(true);
	};

	const handleSaveEdit = async () => {
		if (!team) {
			closeEditDialog();
			return;
		}

		const nameChanged = editName.trim() && editName !== team.name;
		const logoUploaded = selectedLogo !== null;
		const logoRemoved = isLogoRemoved && team.logo !== null;
		const hasChanges = nameChanged || logoUploaded || logoRemoved;

		if (!hasChanges) {
			closeEditDialog();
			return;
		}

		try {
			if (nameChanged) {
				await editMutation.mutateAsync({ name: editName.trim() });
			}

			if (logoUploaded && selectedLogo) {
				const imageData = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => {
						if (typeof reader.result === "string") {
							resolve(reader.result);
						} else {
							reject(new Error("Failed to read file as data URL"));
						}
					};
					reader.onerror = () => reject(new Error("Failed to read file"));
					reader.readAsDataURL(selectedLogo);
				});

				await uploadLogoMutation.mutateAsync({ imageData });
			}

			if (logoRemoved) {
				await deleteLogoMutation.mutateAsync();
			}

			closeEditDialog();
		} catch {
			// Error handling is done in mutation onError callbacks
		}
	};

	if (teamError) {
		return (
			<>
				<Header
					breadcrumbs={[
						{ name: "Leagues", href: "/leagues" },
						{ name: truncateSlug(slug), href: `/leagues/${slug}` },
						{ name: "Team" },
					]}
				/>
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					<Card>
						<CardContent className="p-6">
							<h2 className="text-xl font-bold mb-2">Team Not Found</h2>
							<p className="text-muted-foreground">This team was not found in this league.</p>
						</CardContent>
					</Card>
				</div>
			</>
		);
	}

	const allTimeWinRate =
		allTimeStats && allTimeStats.total > 0
			? Math.round(((allTimeStats.wins || 0) / allTimeStats.total) * 100)
			: 0;

	// Current score: use selected season if filtered, otherwise latest season from history
	const latestSeason = seasonHistory?.[0];
	const currentScore = selectedSeasonId ? filteredSeason?.score : latestSeason?.score;
	const currentScoreLoading = selectedSeasonId ? filteredSeasonLoading : seasonHistoryLoading;

	// Season display for card 4: selected season if filtered, otherwise best season
	const seasonDisplay = selectedSeasonId ? filteredSeason : bestSeason;
	const seasonDisplayLoading = selectedSeasonId ? filteredSeasonLoading : bestSeasonLoading;

	const seasonChartData =
		seasonHistory
			?.map((h) => ({
				season: h.season,
				score: h.score,
				winRate: h.winRate,
				matches: h.matches,
				wins: h.wins,
				losses: h.losses,
				draws: h.draws,
			}))
			.reverse() ?? [];

	return (
		<>
			<Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && closeEditDialog()}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader className="pb-4 border-b border-border">
						<div className="flex items-center gap-3">
							<div className="w-2 h-6 bg-blue-500 rounded-full" />
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								Edit Team
							</DialogTitle>
						</div>
						<DialogDescription className="font-mono text-sm text-muted-foreground">
							Update the team name and logo.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label>Team Logo (Optional)</Label>
							<LogoUpload
								previewUrl={logoPreview}
								fallback={
									<HugeiconsIcon icon={UserMultipleIcon} className="size-12 text-blue-500" />
								}
								onFileSelect={handleFileSelect}
								onRemove={logoPreview ? handleRemoveLogo : undefined}
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-team-name">Team Name</Label>
							<Input
								id="edit-team-name"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								placeholder="Enter team name"
								maxLength={100}
								disabled={isSaving}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							onClick={handleSaveEdit}
							disabled={
								isSaving ||
								((!editName.trim() || editName === team?.name) && !selectedLogo && !isLogoRemoved)
							}
						>
							{isSaving ? "Saving..." : "Save changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Teams", href: `/leagues/${slug}/teams` },
					{ name: team?.name ?? "Team" },
				]}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				{/* Team Header */}
				<Card>
					<CardContent className="p-6">
						<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
							{teamLoading ? (
								<>
									<Skeleton className="h-20 w-20 rounded-lg" />
									<div className="space-y-2">
										<Skeleton className="h-8 w-64" />
										<Skeleton className="h-6 w-20" />
									</div>
								</>
							) : (
								<>
									{team?.logo ? (
										<div className="h-20 w-20 rounded-lg overflow-hidden bg-muted">
											<img
												src={getAssetUrl(team.logo) ?? ""}
												alt={team.name}
												className="h-full w-full object-cover"
											/>
										</div>
									) : (
										<div className="flex h-20 w-20 items-center justify-center rounded-lg bg-blue-500/10">
											<HugeiconsIcon icon={UserMultipleIcon} className="size-10 text-blue-500" />
										</div>
									)}
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<h1 className="text-3xl font-bold">{team?.name}</h1>
											{canEdit && (
												<Button
													variant="ghost"
													size="sm"
													className="text-muted-foreground hover:text-foreground"
													onClick={openEditDialog}
												>
													<HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
												</Button>
											)}
										</div>
										<div className="flex items-center gap-2 mt-1">
											<Badge variant="secondary">{allTimeWinRate}% Win Rate</Badge>
											{players && players.length > 0 && (
												<Badge variant="outline">{players.length} Players</Badge>
											)}
										</div>
									</div>
									{/* Team Players Avatars */}
									<PlayerAvatarGroupInline
										players={players ?? []}
										size="lg"
										max={4}
										isLoading={playersLoading}
									/>
								</>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Season Selector */}
				<div className="flex justify-end">
					<Select
						value={selectedSeasonId ?? "all"}
						onValueChange={(val: string | null) =>
							setSelectedSeasonId(val === "all" || !val ? undefined : val)
						}
					>
						<SelectTrigger className="w-full sm:w-56">
							<SelectValue>
								{selectedSeasonId
									? (seasons?.find((s) => s.id === selectedSeasonId)?.name ?? "All Seasons")
									: "All Seasons"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Seasons</SelectItem>
							{seasons?.map((s) => (
								<SelectItem key={s.id} value={s.id}>
									{s.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Stats Overview */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								{selectedSeasonId ? "Season Score" : "Current Score"}
							</CardTitle>
							<HugeiconsIcon icon={Target01Icon} className="size-4 text-blue-600" />
						</CardHeader>
						<CardContent className="relative">
							{currentScoreLoading ? (
								<>
									<Skeleton className="h-8 w-16 mb-2" />
									<Skeleton className="h-4 w-20" />
								</>
							) : (
								<>
									<div className="text-2xl font-bold">{currentScore ?? "N/A"}</div>
									<p className="text-xs text-muted-foreground">
										{selectedSeasonId
											? (seasons?.find((s) => s.id === selectedSeasonId)?.name ?? "Selected season")
											: latestSeason
												? `Current: ${latestSeason.season}`
												: "No seasons"}
									</p>
								</>
							)}
						</CardContent>
					</Card>

					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
							<HugeiconsIcon icon={Award01Icon} className="size-4 text-emerald-600" />
						</CardHeader>
						<CardContent className="relative">
							{allTimeStatsLoading ? (
								<>
									<Skeleton className="h-8 w-16 mb-2" />
									<Skeleton className="h-4 w-20" />
								</>
							) : (
								<>
									<div className="text-2xl font-bold">{allTimeWinRate}%</div>
									<p className="text-xs text-muted-foreground">
										{allTimeStats?.wins ?? 0}W / {allTimeStats?.losses ?? 0}L
									</p>
								</>
							)}
						</CardContent>
					</Card>

					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								{selectedSeasonId ? "Matches" : "Total Matches"}
							</CardTitle>
							<HugeiconsIcon icon={UserMultiple02Icon} className="size-4 text-amber-600" />
						</CardHeader>
						<CardContent className="relative">
							{allTimeStatsLoading ? (
								<>
									<Skeleton className="h-8 w-16 mb-2" />
									<Skeleton className="h-4 w-20" />
								</>
							) : (
								<>
									<div className="text-2xl font-bold">{allTimeStats?.total ?? 0}</div>
									<p className="text-xs text-muted-foreground">
										{selectedSeasonId
											? "In selected season"
											: `Across ${allTimeStats?.seasonCount ?? 0} season${(allTimeStats?.seasonCount ?? 0) !== 1 ? "s" : ""}`}
									</p>
								</>
							)}
						</CardContent>
					</Card>

					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								{selectedSeasonId ? "Season" : "Best Season"}
							</CardTitle>
							<HugeiconsIcon icon={Calendar01Icon} className="size-4 text-purple-600" />
						</CardHeader>
						<CardContent className="relative">
							{seasonDisplayLoading ? (
								<>
									<Skeleton className="h-8 w-16 mb-2" />
									<Skeleton className="h-4 w-20" />
								</>
							) : seasonDisplay ? (
								<>
									<div className="text-2xl font-bold">{seasonDisplay.season}</div>
									<p className="text-xs text-muted-foreground">
										{selectedSeasonId
											? `Score: ${seasonDisplay.score} (${seasonDisplay.matches} matches)`
											: `Peak: ${seasonDisplay.score} (${seasonDisplay.matches} matches)`}
									</p>
								</>
							) : (
								<>
									<div className="text-2xl font-bold">N/A</div>
									<p className="text-xs text-muted-foreground">No seasons found</p>
								</>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Season Performance Charts */}
				{seasonHistory && seasonHistory.length > 1 && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{/* Season Performance Chart */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<HugeiconsIcon icon={ChartIcon} className="size-5 text-amber-500" />
									Season Performance
								</CardTitle>
								<CardDescription>Score and win rate across all seasons</CardDescription>
							</CardHeader>
							<CardContent>
								{seasonHistoryLoading ? (
									<div className="h-[250px] flex items-center justify-center">
										<Skeleton className="h-full w-full" />
									</div>
								) : seasonChartData.length > 0 ? (
									<ChartContainer config={seasonHistoryConfig} className="min-h-[250px] w-full">
										<LineChart data={seasonChartData}>
											<CartesianGrid vertical={false} strokeDasharray="3 3" />
											<XAxis
												dataKey="season"
												tickLine={false}
												axisLine={false}
												tickMargin={8}
												tickFormatter={(value) => value.slice(0, 10)}
											/>
											<YAxis yAxisId="left" tickLine={false} axisLine={false} />
											<YAxis
												yAxisId="right"
												orientation="right"
												tickLine={false}
												axisLine={false}
												domain={[0, 100]}
											/>
											<ChartTooltip content={<ChartTooltipContent />} />
											<ChartLegend content={<ChartLegendContent />} />
											<Line
												yAxisId="left"
												type="monotone"
												dataKey="score"
												stroke="var(--color-score)"
												strokeWidth={2}
												dot={{ fill: "var(--color-score)" }}
											/>
											<Line
												yAxisId="right"
												type="monotone"
												dataKey="winRate"
												stroke="var(--color-winRate)"
												strokeWidth={2}
												dot={{ fill: "var(--color-winRate)" }}
												strokeDasharray="5 5"
											/>
										</LineChart>
									</ChartContainer>
								) : (
									<div className="h-[250px] flex items-center justify-center text-muted-foreground">
										No season history available
									</div>
								)}
							</CardContent>
						</Card>

						{/* Match Results Distribution */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<HugeiconsIcon icon={UserMultiple02Icon} className="size-5 text-blue-500" />
									Match Results by Season
								</CardTitle>
								<CardDescription>Wins, losses, and draws per season</CardDescription>
							</CardHeader>
							<CardContent>
								{seasonHistoryLoading ? (
									<div className="h-[250px] flex items-center justify-center">
										<Skeleton className="h-full w-full" />
									</div>
								) : seasonChartData.length > 0 ? (
									<ChartContainer config={matchResultsConfig} className="min-h-[250px] w-full">
										<BarChart data={seasonChartData}>
											<CartesianGrid vertical={false} strokeDasharray="3 3" />
											<XAxis
												dataKey="season"
												tickLine={false}
												axisLine={false}
												tickMargin={8}
												tickFormatter={(value) => value.slice(0, 10)}
											/>
											<YAxis tickLine={false} axisLine={false} />
											<ChartTooltip content={<ChartTooltipContent />} />
											<ChartLegend content={<ChartLegendContent />} />
											<Bar dataKey="wins" fill="var(--color-wins)" radius={[4, 4, 0, 0]} />
											<Bar dataKey="losses" fill="var(--color-losses)" radius={[4, 4, 0, 0]} />
											<Bar dataKey="draws" fill="var(--color-draws)" radius={[4, 4, 0, 0]} />
										</BarChart>
									</ChartContainer>
								) : (
									<div className="h-[250px] flex items-center justify-center text-muted-foreground">
										No season data available
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				)}

				{/* Rival Analysis */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{/* Best Rival */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HugeiconsIcon icon={ArrowUp01Icon} className="size-5 text-green-500" />
								Best Rival
							</CardTitle>
							<CardDescription>Team you perform best against</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{rivalsLoading ? (
								<div className="flex items-center gap-3">
									<Skeleton className="h-10 w-10 rounded-lg" />
									<div className="space-y-2">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-28" />
									</div>
								</div>
							) : rivalsError ? (
								<div className="text-center text-red-500 py-8">
									<p className="font-medium">Error loading rival data</p>
									<p className="text-sm text-muted-foreground mt-1">
										{rivalsError.message || "Please try refreshing the page"}
									</p>
								</div>
							) : rivalTeams?.bestRival ? (
								<>
									<div className="flex items-center gap-3">
										{rivalTeams.bestRival.logo ? (
											<div className="h-10 w-10 rounded-lg overflow-hidden bg-muted">
												<img
													src={getAssetUrl(rivalTeams.bestRival.logo) ?? ""}
													alt={rivalTeams.bestRival.name}
													className="h-full w-full object-cover"
												/>
											</div>
										) : (
											<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
												<HugeiconsIcon icon={UserMultipleIcon} className="size-5 text-blue-500" />
											</div>
										)}
										<div>
											<p className="font-medium">{rivalTeams.bestRival.name}</p>
											<p className="text-sm text-muted-foreground">
												{rivalTeams.bestRival.matchesPlayed} matches played
											</p>
										</div>
									</div>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">Win Rate</span>
											<span className="text-sm font-medium text-green-500">
												{rivalTeams.bestRival.winRate}%
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">Record</span>
											<span className="text-sm font-medium">
												{rivalTeams.bestRival.wins}W-{rivalTeams.bestRival.losses}L
											</span>
										</div>
									</div>
								</>
							) : (
								<div className="text-center text-muted-foreground py-8">
									No rival data available
								</div>
							)}
						</CardContent>
					</Card>

					{/* Worst Rival */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HugeiconsIcon icon={ArrowDown01Icon} className="size-5 text-red-500" />
								Worst Rival
							</CardTitle>
							<CardDescription>Team you struggle against most</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{rivalsLoading ? (
								<div className="flex items-center gap-3">
									<Skeleton className="h-10 w-10 rounded-lg" />
									<div className="space-y-2">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-28" />
									</div>
								</div>
							) : rivalsError ? (
								<div className="text-center text-red-500 py-8">
									<p className="font-medium">Error loading rival data</p>
									<p className="text-sm text-muted-foreground mt-1">
										{rivalsError.message || "Please try refreshing the page"}
									</p>
								</div>
							) : rivalTeams?.worstRival ? (
								<>
									<div className="flex items-center gap-3">
										{rivalTeams.worstRival.logo ? (
											<div className="h-10 w-10 rounded-lg overflow-hidden bg-muted">
												<img
													src={getAssetUrl(rivalTeams.worstRival.logo) ?? ""}
													alt={rivalTeams.worstRival.name}
													className="h-full w-full object-cover"
												/>
											</div>
										) : (
											<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
												<HugeiconsIcon icon={UserMultipleIcon} className="size-5 text-red-500" />
											</div>
										)}
										<div>
											<p className="font-medium">{rivalTeams.worstRival.name}</p>
											<p className="text-sm text-muted-foreground">
												{rivalTeams.worstRival.matchesPlayed} matches played
											</p>
										</div>
									</div>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">Win Rate</span>
											<span className="text-sm font-medium text-red-500">
												{rivalTeams.worstRival.winRate}%
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">Record</span>
											<span className="text-sm font-medium">
												{rivalTeams.worstRival.wins}W-{rivalTeams.worstRival.losses}L
											</span>
										</div>
									</div>
								</>
							) : (
								<div className="text-center text-muted-foreground py-8">
									No rival data available
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Team Players */}
				<Card>
					<CardHeader>
						<CardTitle>Team Roster</CardTitle>
						<CardDescription>Current team members</CardDescription>
					</CardHeader>
					<CardContent>
						{playersLoading ? (
							<PlayerAvatarGroupGrid players={[]} size="xl" isLoading />
						) : players && players.length > 0 ? (
							<PlayerAvatarGroupGrid players={players} size="xl" />
						) : (
							<div className="text-center text-muted-foreground py-8">
								No players assigned to this team
							</div>
						)}
					</CardContent>
				</Card>

				{/* Recent Matches */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Matches</CardTitle>
						<CardDescription>Latest match results and score changes</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{matchesLoading ? (
								Array.from({ length: 5 }).map((_, index) => (
									<div
										key={`match-skeleton-${String(index)}`}
										className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
									>
										<div className="flex items-center gap-4">
											<Skeleton className="h-8 w-8 rounded-lg" />
											<div className="space-y-1">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-20" />
											</div>
										</div>
										<div className="text-right space-y-1">
											<Skeleton className="h-4 w-12" />
											<Skeleton className="h-3 w-16" />
										</div>
									</div>
								))
							) : recentMatches && recentMatches.length > 0 ? (
								recentMatches.map((match) => {
									const scoreChange = match.scoreAfter - match.scoreBefore;
									const isWin = match.result === "W";
									const isLoss = match.result === "L";
									return (
										<div
											key={match.matchId}
											className="relative flex items-center justify-between p-3 rounded-lg bg-muted/20 overflow-hidden"
										>
											<div
												className={`absolute inset-y-0 left-0 w-24 ${
													isWin
														? "bg-[radial-gradient(circle_at_left,_rgba(34,197,94,0.15),transparent_70%)]"
														: isLoss
															? "bg-[radial-gradient(circle_at_left,_rgba(239,68,68,0.15),transparent_70%)]"
															: "bg-[radial-gradient(circle_at_left,_rgba(156,163,175,0.15),transparent_70%)]"
												}`}
											/>
											<div className="relative flex items-center gap-4">
												<div
													className={`flex items-center justify-center h-10 w-10 rounded-lg text-sm font-bold ${
														isWin
															? "bg-green-500/20 text-green-500"
															: isLoss
																? "bg-red-500/20 text-red-500"
																: "bg-muted text-muted-foreground"
													}`}
												>
													{match.result}
												</div>
												<div>
													<p className="font-medium">
														{match.myTeamName} vs {match.opponentName}
													</p>
													<p className="text-sm text-muted-foreground">
														{match.myTeamScore} - {match.opponentScore} •{" "}
														{new Date(match.createdAt).toLocaleDateString()}
													</p>
												</div>
											</div>
											<div className="relative text-right">
												<p className="font-medium">
													{match.scoreBefore} → {match.scoreAfter}
												</p>
												<p
													className={`text-sm ${
														scoreChange > 0
															? "text-green-500"
															: scoreChange < 0
																? "text-red-500"
																: "text-muted-foreground"
													}`}
												>
													{scoreChange > 0 ? "+" : ""}
													{scoreChange}
												</p>
											</div>
										</div>
									);
								})
							) : (
								<div className="text-center text-muted-foreground py-8">No recent matches</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</>
	);
}
