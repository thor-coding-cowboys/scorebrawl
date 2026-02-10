import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC, trpcClient } from "@/lib/trpc";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Target01Icon,
	Award01Icon,
	UserMultiple02Icon,
	Medal01Icon,
	ArrowUp01Icon,
	ArrowDown01Icon,
	Calendar01Icon,
} from "@hugeicons/core-free-icons";

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/"
)({
	component: PlayerProfilePage,
	loader: async ({ params }) => {
		return { slug: params.slug, leaguePlayerId: params.leaguePlayerId };
	},
});

function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}...`;
}

function PlayerProfilePage() {
	const { slug, leaguePlayerId } = Route.useLoaderData();
	const trpc = useTRPC();

	// Get active season for season-specific queries
	const { data: activeSeason } = useQuery({
		queryKey: ["activeSeason", slug],
		queryFn: async () => {
			return await trpcClient.season.findActive.query();
		},
	});

	const seasonSlug = activeSeason?.slug;

	// Player basic info
	const {
		data: player,
		isLoading: playerLoading,
		error: playerError,
	} = useQuery({
		...trpc.player.getById.queryOptions({
			seasonSlug: seasonSlug ?? "",
			playerId: leaguePlayerId,
		}),
		enabled: !!seasonSlug,
	});

	// All-time stats across all seasons
	const { data: allTimeStats, isLoading: allTimeStatsLoading } = useQuery(
		trpc.player.getAllTimeStats.queryOptions({ playerId: leaguePlayerId })
	);

	// Best season
	const { data: bestSeason, isLoading: bestSeasonLoading } = useQuery(
		trpc.player.getBestSeason.queryOptions({ playerId: leaguePlayerId })
	);

	// Best teammate
	const { data: bestTeammate, isLoading: bestTeammateLoading } = useQuery(
		trpc.player.getBestTeammate.queryOptions({ playerId: leaguePlayerId })
	);

	// Worst teammate
	const { data: worstTeammate, isLoading: worstTeammateLoading } = useQuery(
		trpc.player.getWorstTeammate.queryOptions({ playerId: leaguePlayerId })
	);

	// Recent matches with team names
	const { data: recentMatches, isLoading: matchesLoading } = useQuery({
		...trpc.player.getRecentMatchesWithTeams.queryOptions({
			seasonSlug: seasonSlug ?? "",
			playerId: leaguePlayerId,
		}),
		enabled: !!seasonSlug,
	});

	// Achievements
	const { data: achievements, isLoading: achievementsLoading } = useQuery(
		trpc.achievement.getByPlayerId.queryOptions({ playerId: leaguePlayerId })
	);

	// Handle errors
	if (playerError) {
		return (
			<>
				<Header
					breadcrumbs={[
						{ name: "Leagues", href: "/leagues" },
						{ name: truncateSlug(slug), href: `/leagues/${slug}` },
						{ name: "Player" },
					]}
				/>
				<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
					<Card>
						<CardContent className="p-6">
							<h2 className="text-xl font-bold mb-2">Player Not Found</h2>
							<p className="text-muted-foreground">This player was not found in this league.</p>
						</CardContent>
					</Card>
				</div>
			</>
		);
	}

	// Calculate win rate from all-time stats
	const allTimeWinRate =
		allTimeStats && allTimeStats.total > 0
			? Math.round(((allTimeStats.wins || 0) / allTimeStats.total) * 100)
			: 0;

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Seasons", href: `/leagues/${slug}/seasons` },
					...(seasonSlug
						? [
								{
									name: activeSeason?.name ?? truncateSlug(seasonSlug),
									href: `/leagues/${slug}/seasons/${seasonSlug}`,
								},
							]
						: []),
					{ name: player?.name ?? "Player" },
				]}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				{/* Player Header */}
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							{playerLoading ? (
								<>
									<Skeleton className="h-20 w-20 rounded-lg" />
									<div className="space-y-2">
										<Skeleton className="h-8 w-64" />
										<div className="flex gap-2">
											<Skeleton className="h-6 w-20" />
										</div>
									</div>
								</>
							) : (
								<>
									<Avatar className="h-20 w-20 rounded-lg">
										<AvatarImage
											src={player?.image ?? undefined}
											alt={player?.name ?? "Player"}
											className="rounded-lg"
										/>
										<AvatarFallback className="text-2xl rounded-lg">
											{player?.name?.charAt(0) ?? "P"}
										</AvatarFallback>
									</Avatar>
									<div>
										<h1 className="text-3xl font-bold">{player?.name}</h1>
										<div className="flex items-center gap-2 mt-1">
											<Badge variant="secondary">{allTimeWinRate}% Win Rate</Badge>
										</div>
									</div>
								</>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Stats Overview */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Current Score
							</CardTitle>
							<HugeiconsIcon icon={Target01Icon} className="size-4 text-blue-600" />
						</CardHeader>
						<CardContent className="relative">
							{bestSeasonLoading ? (
								<>
									<Skeleton className="h-8 w-16 mb-2" />
									<Skeleton className="h-4 w-20" />
								</>
							) : (
								<>
									<div className="text-2xl font-bold">{bestSeason?.elo ?? "N/A"}</div>
									<p className="text-xs text-muted-foreground">Current season</p>
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
								Total Matches
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
										Across {allTimeStats?.seasonCount ?? 0} season
										{(allTimeStats?.seasonCount ?? 0) !== 1 ? "s" : ""}
									</p>
								</>
							)}
						</CardContent>
					</Card>

					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Best Season
							</CardTitle>
							<HugeiconsIcon icon={Calendar01Icon} className="size-4 text-purple-600" />
						</CardHeader>
						<CardContent className="relative">
							{bestSeasonLoading ? (
								<>
									<Skeleton className="h-8 w-16 mb-2" />
									<Skeleton className="h-4 w-20" />
								</>
							) : bestSeason ? (
								<>
									<div className="text-2xl font-bold">{bestSeason.season}</div>
									<p className="text-xs text-muted-foreground">
										Peak: {bestSeason.elo} ({bestSeason.matches} matches)
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

				{/* Teammate Analysis */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{/* Best Teammate */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HugeiconsIcon icon={ArrowUp01Icon} className="size-5 text-green-500" />
								Best Teammate
							</CardTitle>
							<CardDescription>Highest win rate together</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{bestTeammateLoading ? (
								<>
									<div className="flex items-center gap-3">
										<Skeleton className="h-10 w-10 rounded-lg" />
										<div className="space-y-2">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-3 w-28" />
										</div>
									</div>
								</>
							) : bestTeammate ? (
								<>
									<div className="flex items-center gap-3">
										<Avatar className="rounded-lg">
											<AvatarImage
												src={bestTeammate.avatar ?? undefined}
												alt={bestTeammate.name}
												className="rounded-lg"
											/>
											<AvatarFallback className="rounded-lg">
												{bestTeammate.name.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="font-medium">{bestTeammate.name}</p>
											<p className="text-sm text-muted-foreground">
												{bestTeammate.matchesTogether} matches together
											</p>
										</div>
									</div>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">Win Rate</span>
											<span className="text-sm font-medium text-green-500">
												{bestTeammate.winRate}%
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">Record</span>
											<span className="text-sm font-medium">
												{bestTeammate.wins}W-{bestTeammate.losses}L
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">ELO Impact</span>
											<span className="text-sm font-medium text-green-500">
												+{bestTeammate.eloGained}
											</span>
										</div>
									</div>
								</>
							) : (
								<div className="text-center text-muted-foreground py-8">
									No teammate data available
								</div>
							)}
						</CardContent>
					</Card>

					{/* Worst Teammate */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HugeiconsIcon icon={ArrowDown01Icon} className="size-5 text-red-500" />
								Worst Teammate
							</CardTitle>
							<CardDescription>Lowest win rate together</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{worstTeammateLoading ? (
								<>
									<div className="flex items-center gap-3">
										<Skeleton className="h-10 w-10 rounded-lg" />
										<div className="space-y-2">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-3 w-28" />
										</div>
									</div>
								</>
							) : worstTeammate ? (
								<>
									<div className="flex items-center gap-3">
										<Avatar className="rounded-lg">
											<AvatarImage
												src={worstTeammate.avatar ?? undefined}
												alt={worstTeammate.name}
												className="rounded-lg"
											/>
											<AvatarFallback className="rounded-lg">
												{worstTeammate.name.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="font-medium">{worstTeammate.name}</p>
											<p className="text-sm text-muted-foreground">
												{worstTeammate.matchesTogether} matches together
											</p>
										</div>
									</div>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">Win Rate</span>
											<span className="text-sm font-medium text-red-500">
												{worstTeammate.winRate}%
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">Record</span>
											<span className="text-sm font-medium">
												{worstTeammate.wins}W-{worstTeammate.losses}L
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-muted-foreground">ELO Impact</span>
											<span className="text-sm font-medium text-red-500">
												{worstTeammate.eloLost > 0
													? `-${worstTeammate.eloLost}`
													: worstTeammate.eloGained}
											</span>
										</div>
									</div>
								</>
							) : (
								<div className="text-center text-muted-foreground py-8">
									No teammate data available
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Achievements */}
				<Card>
					<CardHeader>
						<CardTitle>Achievements</CardTitle>
						<CardDescription>Unlocked gaming milestones and accomplishments</CardDescription>
					</CardHeader>
					<CardContent>
						{achievementsLoading ? (
							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
								{Array.from({ length: 4 }).map((_, i) => (
									<div
										key={`achievement-skeleton-${String(i)}`}
										className="flex flex-col items-center space-y-2"
									>
										<Skeleton className="w-16 h-16 rounded-full" />
										<Skeleton className="h-4 w-20" />
									</div>
								))}
							</div>
						) : achievements && achievements.length > 0 ? (
							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
								{achievements.map((achievement) => (
									<div key={achievement.type} className="flex flex-col items-center space-y-2">
										<div className="w-16 h-16 rounded-full flex items-center justify-center border-2 bg-primary/10 border-primary/20">
											<HugeiconsIcon icon={Medal01Icon} className="size-8 text-primary" />
										</div>
										<div className="text-center">
											<p className="text-sm font-medium">
												{formatAchievementName(achievement.type)}
											</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-center text-muted-foreground py-8">No achievements yet</div>
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
											{/* Left glow effect */}
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
														{match.homeTeamName} vs {match.awayTeamName}
													</p>
													<p className="text-sm text-muted-foreground">
														{match.homeScore} - {match.awayScore} •{" "}
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

function formatAchievementName(type: string): string {
	return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
