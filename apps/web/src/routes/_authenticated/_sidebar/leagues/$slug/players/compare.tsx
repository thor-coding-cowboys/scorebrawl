import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useTRPC, trpcClient } from "@/lib/trpc";
import { truncateSlug, cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Target01Icon,
	ZapIcon,
	ActivityIcon,
	CrownIcon,
	FireIcon,
	Rocket01Icon,
	ChartBarLineIcon,
	GitCompareIcon,
	Medal01Icon,
	Clock01Icon,
	ChartLineData01Icon,
	FlashIcon,
	UserAdd01Icon,
	Tick01Icon,
} from "@hugeicons/core-free-icons";
import {
	CartesianGrid,
	XAxis,
	YAxis,
	Line,
	LineChart,
	Radar,
	RadarChart,
	PolarGrid,
	PolarAngleAxis,
	PolarRadiusAxis,
	ResponsiveContainer,
	Tooltip,
	Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/players/compare")({
	component: PlayerComparisonPage,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

function PlayerComparisonPage() {
	const { slug } = Route.useLoaderData();
	const trpc = useTRPC();
	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);

	// Get active season for context
	useQuery({
		queryKey: ["activeSeason", slug],
		queryFn: async () => {
			return await trpcClient.season.findActive.query();
		},
	});

	// Get all players for selection
	const { data: allPlayers, isLoading: playersLoading } = useQuery(
		trpc.player.getAll.queryOptions()
	);

	// Player 1 is the first player in the list (or could be passed via URL params later)
	const player1Id = allPlayers?.[0]?.id;
	const player2Id = selectedPlayerId;

	// Get comparison data only when both players are selected
	const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
		...trpc.player.comparePlayers.queryOptions({
			player1Id: player1Id ?? "",
			player2Id: player2Id ?? "",
		}),
		enabled: !!player1Id && !!player2Id && player1Id !== player2Id,
	});

	// Get season history for both players for charts
	const { data: player1History } = useQuery({
		...trpc.player.getSeasonHistory.queryOptions({
			playerId: player1Id ?? "",
		}),
		enabled: !!player1Id,
	});

	const { data: player2History } = useQuery({
		...trpc.player.getSeasonHistory.queryOptions({
			playerId: player2Id ?? "",
		}),
		enabled: !!player2Id,
	});

	const p1 = comparisonData?.player1;
	const p2 = comparisonData?.player2;
	const h2h = comparisonData?.headToHead;

	// Get player 2 basic info for the empty state card
	const player2Basic = allPlayers?.find((p) => p.id === player2Id);

	// Available players for selection (exclude player 1 and already selected player 2)
	const availablePlayers = allPlayers?.filter((p) => p.id !== player1Id) || [];

	// Handle player selection from drawer
	const handlePlayerSelect = (playerId: string) => {
		setSelectedPlayerId(playerId);
		setIsDrawerOpen(false);
	};

	// Prepare chart data
	const combinedSeasonData = () => {
		if (!player1History || !player2History) return [];

		const allSeasons = new Set([
			...player1History.map((h) => h.season),
			...player2History.map((h) => h.season),
		]);

		return Array.from(allSeasons).map((season) => {
			const p1Data = player1History.find((h) => h.season === season);
			const p2Data = player2History.find((h) => h.season === season);

			return {
				season: season.slice(0, 10),
				[p1?.name || "Player 1"]: p1Data?.score || 0,
				[p2?.name || "Player 2"]: p2Data?.score || 0,
				[`${p1?.name || "P1"}_WinRate`]: p1Data?.winRate || 0,
				[`${p2?.name || "P2"}_WinRate`]: p2Data?.winRate || 0,
			};
		});
	};

	const radarData = [
		{
			stat: "Win Rate",
			p1: p1?.winRate || 0,
			p2: p2?.winRate || 0,
		},
		{
			stat: "Matches",
			p1: p1 ? (p1.totalMatches / Math.max(p1.totalMatches, p2?.totalMatches || 1)) * 100 : 0,
			p2: p2 ? (p2.totalMatches / Math.max(p1?.totalMatches || 1, p2.totalMatches)) * 100 : 0,
		},
		{
			stat: "Consistency",
			p1: p1 ? Math.max(0, 100 - p1.consistencyScore) : 0,
			p2: p2 ? Math.max(0, 100 - p2.consistencyScore) : 0,
		},
		{
			stat: "Comebacks",
			p1: p1 ? Math.min(100, p1.comebackWins * 10) : 0,
			p2: p2 ? Math.min(100, p2.comebackWins * 10) : 0,
		},
		{
			stat: "Peak ELO",
			p1: p1 ? (p1.highestElo / Math.max(p1.highestElo, p2?.highestElo || 1)) * 100 : 0,
			p2: p2 ? (p2.highestElo / Math.max(p1?.highestElo || 1, p2.highestElo)) * 100 : 0,
		},
	];

	// Comparison card helper
	const StatComparison = ({
		label,
		p1Value,
		p2Value,
		p1Display,
		p2Display,
		higherIsBetter = true,
		suffix = "",
	}: {
		label: string;
		p1Value: number;
		p2Value: number;
		p1Display?: string;
		p2Display?: string;
		higherIsBetter?: boolean;
		suffix?: string;
	}) => {
		const diff = p1Value - p2Value;
		const p1Better = higherIsBetter ? diff > 0 : diff < 0;
		const p2Better = higherIsBetter ? diff < 0 : diff > 0;

		return (
			<div className="grid grid-cols-3 items-center gap-4 py-3 border-b last:border-0">
				<div className="text-right">
					<div
						className={`text-lg font-bold ${p1Better ? "text-green-500" : "text-muted-foreground"}`}
					>
						{p1Display || `${p1Value}${suffix}`}
						{p1Better && <HugeiconsIcon icon={CrownIcon} className="inline size-4 ml-1" />}
					</div>
				</div>
				<div className="text-center text-sm text-muted-foreground font-medium">{label}</div>
				<div className="text-left">
					<div
						className={`text-lg font-bold ${p2Better ? "text-green-500" : "text-muted-foreground"}`}
					>
						{p2Display || `${p2Value}${suffix}`}
						{p2Better && <HugeiconsIcon icon={CrownIcon} className="inline size-4 ml-1" />}
					</div>
				</div>
			</div>
		);
	};

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Players", href: `/leagues/${slug}/players` },
					{ name: "Compare" },
				]}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				{/* Player Selector Header */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<HugeiconsIcon icon={GitCompareIcon} className="size-6 text-primary" />
							Player Comparison
						</CardTitle>
						<CardDescription>Select players to compare their statistics</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col sm:flex-row items-center gap-4">
							{/* Player 1 Display */}
							<div className="flex-1 w-full">
								{playersLoading ? (
									<Skeleton className="h-14 w-full" />
								) : (
									<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
										<Avatar className="h-12 w-12 rounded-lg">
											<AvatarImage
												src={allPlayers?.[0]?.image ?? undefined}
												className="rounded-lg"
											/>
											<AvatarFallback className="rounded-lg text-lg">
												{allPlayers?.[0]?.name?.charAt(0) ?? "P"}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="font-semibold">{allPlayers?.[0]?.name}</p>
											<p className="text-sm text-muted-foreground">Player 1</p>
										</div>
									</div>
								)}
							</div>

							<div className="text-muted-foreground">
								<HugeiconsIcon icon={GitCompareIcon} className="size-6" />
							</div>

							{/* Player 2 Selector - Opens Drawer */}
							<div className="flex-1 w-full">
								{playersLoading ? (
									<Skeleton className="h-14 w-full" />
								) : selectedPlayerId && player2Basic ? (
									<button
										type="button"
										onClick={() => setIsDrawerOpen(true)}
										className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
									>
										<Avatar className="h-12 w-12 rounded-lg">
											<AvatarImage src={player2Basic.image ?? undefined} className="rounded-lg" />
											<AvatarFallback className="rounded-lg text-lg">
												{player2Basic.name.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<p className="font-semibold">{player2Basic.name}</p>
											<p className="text-sm text-muted-foreground">Player 2 (click to change)</p>
										</div>
										<HugeiconsIcon icon={GitCompareIcon} className="size-4 text-muted-foreground" />
									</button>
								) : (
									<button
										type="button"
										onClick={() => setIsDrawerOpen(true)}
										className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
									>
										<HugeiconsIcon icon={UserAdd01Icon} className="size-5" />
										<span className="font-medium">Select Player 2</span>
									</button>
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Comparison Header with Both Players */}
				{comparisonLoading ? (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Skeleton className="h-40" />
						<Skeleton className="h-40" />
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Player 1 Card */}
						{p1 ? (
							<Card className="relative overflow-hidden border-l-4 border-l-blue-500">
								<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
								<CardContent className="relative p-6">
									<div className="flex items-center gap-4">
										<Avatar className="h-20 w-20 rounded-xl ring-4 ring-blue-500/20">
											<AvatarImage src={p1.avatar ?? undefined} className="rounded-xl" />
											<AvatarFallback className="text-2xl rounded-xl bg-blue-500/10 text-blue-500">
												{p1.name.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<h2 className="text-2xl font-bold">{p1.name}</h2>
											<div className="flex items-center gap-2 mt-2">
												<Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
													{p1.winRate}% Win Rate
												</Badge>
												<Badge variant="outline">{p1.totalMatches} Matches</Badge>
											</div>
										</div>
									</div>
									<div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
										<div className="text-center">
											<p className="text-2xl font-bold text-blue-500">{p1.currentElo}</p>
											<p className="text-xs text-muted-foreground">Current ELO</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold">{p1.highestElo}</p>
											<p className="text-xs text-muted-foreground">Peak ELO</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold">{p1.seasonsPlayed}</p>
											<p className="text-xs text-muted-foreground">Seasons</p>
										</div>
									</div>
								</CardContent>
							</Card>
						) : (
							<Card className="relative overflow-hidden border-l-4 border-l-blue-500">
								<CardContent className="relative p-6">
									<div className="flex items-center gap-4">
										<Avatar className="h-20 w-20 rounded-xl">
											<AvatarFallback className="text-2xl rounded-lg bg-blue-500/10 text-blue-500">
												{allPlayers?.[0]?.name?.charAt(0) ?? "P"}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<h2 className="text-2xl font-bold">{allPlayers?.[0]?.name ?? "Player 1"}</h2>
											<Badge variant="outline">Waiting for opponent...</Badge>
										</div>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Player 2 Card - Empty State or Data */}
						{p2 ? (
							<Card className="relative overflow-hidden border-l-4 border-l-rose-500">
								<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(244,63,94,0.1),transparent_60%)]" />
								<CardContent className="relative p-6">
									<div className="flex items-center gap-4">
										<Avatar className="h-20 w-20 rounded-xl ring-4 ring-rose-500/20">
											<AvatarImage src={p2.avatar ?? undefined} className="rounded-xl" />
											<AvatarFallback className="text-2xl rounded-xl bg-rose-500/10 text-rose-500">
												{p2.name.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<h2 className="text-2xl font-bold">{p2.name}</h2>
											<div className="flex items-center gap-2 mt-2">
												<Badge variant="secondary" className="bg-rose-500/10 text-rose-500">
													{p2.winRate}% Win Rate
												</Badge>
												<Badge variant="outline">{p2.totalMatches} Matches</Badge>
											</div>
										</div>
									</div>
									<div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
										<div className="text-center">
											<p className="text-2xl font-bold text-rose-500">{p2.currentElo}</p>
											<p className="text-xs text-muted-foreground">Current ELO</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold">{p2.highestElo}</p>
											<p className="text-xs text-muted-foreground">Peak ELO</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold">{p2.seasonsPlayed}</p>
											<p className="text-xs text-muted-foreground">Seasons</p>
										</div>
									</div>
								</CardContent>
							</Card>
						) : (
							<Card className="relative overflow-hidden border-l-4 border-l-muted">
								<CardContent className="p-6">
									<div className="flex flex-col items-center justify-center h-full min-h-[160px] text-center">
										<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
											<HugeiconsIcon
												icon={UserAdd01Icon}
												className="size-8 text-muted-foreground"
											/>
										</div>
										<h3 className="text-lg font-semibold mb-2">Select a Player</h3>
										<p className="text-sm text-muted-foreground mb-4 max-w-[200px]">
											Choose another player to compare stats and see head-to-head records
										</p>
										<Button onClick={() => setIsDrawerOpen(true)} size="sm">
											<HugeiconsIcon icon={UserAdd01Icon} className="size-4 mr-1" />
											Select Player
										</Button>
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				)}

				{/* Head to Head Section */}
				{h2h && h2h.matchesPlayed > 0 && (
					<Card className="border-2 border-amber-500/20">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HugeiconsIcon icon={Medal01Icon} className="size-5 text-amber-500" />
								Head to Head
							</CardTitle>
							<CardDescription>Direct matchup statistics</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-3 gap-8 items-center">
								{/* Player 1 H2H */}
								<div className="text-center">
									<div className="text-4xl font-bold text-blue-500">{h2h.player1Wins}</div>
									<p className="text-sm text-muted-foreground mt-1">Wins</p>
									<div className="text-xs text-muted-foreground mt-2">
										{h2h.player1GoalsFor} GF · {h2h.player1GoalsAgainst} GA
									</div>
								</div>

								{/* Center Stats */}
								<div className="text-center">
									<div className="text-2xl font-bold">{h2h.matchesPlayed}</div>
									<p className="text-sm text-muted-foreground">Matches</p>
									<div className="text-lg font-semibold text-muted-foreground mt-2">
										{h2h.draws} Draws
									</div>
									{h2h.biggestWin && (
										<div className="mt-3 p-2 rounded-lg bg-muted text-xs">
											<p className="font-medium">Biggest Win</p>
											<p className="text-muted-foreground">
												{h2h.biggestWin.winnerId === player1Id ? p1?.name : p2?.name}{" "}
												{h2h.biggestWin.score}
											</p>
										</div>
									)}
								</div>

								{/* Player 2 H2H */}
								<div className="text-center">
									<div className="text-4xl font-bold text-rose-500">{h2h.player2Wins}</div>
									<p className="text-sm text-muted-foreground mt-1">Wins</p>
									<div className="text-xs text-muted-foreground mt-2">
										{h2h.player2GoalsFor} GF · {h2h.player2GoalsAgainst} GA
									</div>
								</div>
							</div>

							{/* Recent H2H Matches */}
							{h2h.recentMatches.length > 0 && (
								<div className="mt-6 pt-6 border-t">
									<h4 className="text-sm font-medium mb-3 flex items-center gap-2">
										<HugeiconsIcon icon={Clock01Icon} className="size-4" />
										Recent Encounters
									</h4>
									<div className="space-y-2">
										{h2h.recentMatches.slice(0, 5).map((match) => {
											const p1Won = match.result === "W";
											return (
												<div
													key={match.matchId}
													className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
												>
													<div className="flex items-center gap-3">
														<div
															className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm font-bold ${
																p1Won
																	? "bg-blue-500/20 text-blue-500"
																	: "bg-rose-500/20 text-rose-500"
															}`}
														>
															{p1Won ? "W" : "L"}
														</div>
														<div>
															<p className="font-medium">
																{match.homeScore} - {match.awayScore}
															</p>
															<p className="text-xs text-muted-foreground">
																{new Date(match.date).toLocaleDateString()} · {p1Won ? "+" : ""}
																{match.player1ScoreAfter - match.player1ScoreBefore} ELO
															</p>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				)}

				{/* Stats Comparison Table */}
				{p1 && p2 && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HugeiconsIcon icon={ChartBarLineIcon} className="size-5 text-primary" />
								Stat Comparison
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-3 gap-4 mb-4 text-sm font-medium text-muted-foreground">
								<div className="text-right">{p1.name}</div>
								<div className="text-center">Stat</div>
								<div className="text-left">{p2.name}</div>
							</div>

							<StatComparison
								label="Win Rate"
								p1Value={p1.winRate}
								p2Value={p2.winRate}
								suffix="%"
							/>
							<StatComparison
								label="Total Matches"
								p1Value={p1.totalMatches}
								p2Value={p2.totalMatches}
								higherIsBetter={false}
							/>
							<StatComparison label="Highest ELO" p1Value={p1.highestElo} p2Value={p2.highestElo} />
							<StatComparison
								label="Lowest ELO"
								p1Value={p1.lowestElo}
								p2Value={p2.lowestElo}
								higherIsBetter={true}
								p1Display={`${p1.lowestElo}`}
								p2Display={`${p2.lowestElo}`}
							/>
							<StatComparison
								label="Longest Win Streak"
								p1Value={p1.longestWinStreak}
								p2Value={p2.longestWinStreak}
							/>
							<StatComparison
								label="Comeback Wins"
								p1Value={p1.comebackWins}
								p2Value={p2.comebackWins}
							/>
							<StatComparison
								label="Blowout Wins"
								p1Value={p1.blowoutWins}
								p2Value={p2.blowoutWins}
							/>
							<StatComparison
								label="Net ELO Change"
								p1Value={p1.netEloChange}
								p2Value={p2.netEloChange}
								p1Display={`${p1.netEloChange > 0 ? "+" : ""}${p1.netEloChange}`}
								p2Display={`${p2.netEloChange > 0 ? "+" : ""}${p2.netEloChange}`}
							/>
						</CardContent>
					</Card>
				)}

				{/* Charts Section */}
				{p1 && p2 && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{/* ELO Progression Chart */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<HugeiconsIcon icon={ChartLineData01Icon} className="size-5 text-green-500" />
									ELO Progression
								</CardTitle>
								<CardDescription>Final score across seasons</CardDescription>
							</CardHeader>
							<CardContent>
								<ChartContainer
									config={{
										[p1.name]: { label: p1.name, color: "#3b82f6" },
										[p2.name]: { label: p2.name, color: "#f43f5e" },
									}}
									className="h-[300px]"
								>
									<LineChart data={combinedSeasonData()}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="season" />
										<YAxis />
										<ChartTooltip content={<ChartTooltipContent />} />
										<Legend />
										<Line
											type="monotone"
											dataKey={p1.name}
											stroke="#3b82f6"
											strokeWidth={2}
											dot={{ fill: "#3b82f6" }}
										/>
										<Line
											type="monotone"
											dataKey={p2.name}
											stroke="#f43f5e"
											strokeWidth={2}
											dot={{ fill: "#f43f5e" }}
										/>
									</LineChart>
								</ChartContainer>
							</CardContent>
						</Card>

						{/* Radar Chart */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<HugeiconsIcon icon={ActivityIcon} className="size-5 text-purple-500" />
									Performance Profile
								</CardTitle>
								<CardDescription>Relative strengths comparison</CardDescription>
							</CardHeader>
							<CardContent>
								<ResponsiveContainer width="100%" height={300}>
									<RadarChart data={radarData}>
										<PolarGrid />
										<PolarAngleAxis dataKey="stat" />
										<PolarRadiusAxis angle={30} domain={[0, 100]} />
										<Radar
											name={p1.name}
											dataKey="p1"
											stroke="#3b82f6"
											fill="#3b82f6"
											fillOpacity={0.3}
										/>
										<Radar
											name={p2.name}
											dataKey="p2"
											stroke="#f43f5e"
											fill="#f43f5e"
											fillOpacity={0.3}
										/>
										<Legend />
										<Tooltip />
									</RadarChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Fun Stats Cards */}
				{p1 && p2 && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HugeiconsIcon icon={ZapIcon} className="size-5 text-yellow-500" />
								Fun Statistics
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
								{/* Comeback King */}
								<div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
									<div className="flex items-center gap-2 mb-2">
										<HugeiconsIcon icon={Rocket01Icon} className="size-5 text-amber-500" />
										<h4 className="font-semibold">Comeback King</h4>
									</div>
									<p className="text-2xl font-bold">
										{p1.comebackWins > p2.comebackWins ? p1.name : p2.name}
									</p>
									<p className="text-sm text-muted-foreground">Most wins after losing streak</p>
								</div>

								{/* Dominator */}
								<div className="p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20">
									<div className="flex items-center gap-2 mb-2">
										<HugeiconsIcon icon={FlashIcon} className="size-5 text-red-500" />
										<h4 className="font-semibold">The Dominator</h4>
									</div>
									<p className="text-2xl font-bold">
										{p1.blowoutWins > p2.blowoutWins ? p1.name : p2.name}
									</p>
									<p className="text-sm text-muted-foreground">Most blowout wins (3+ goals)</p>
								</div>

								{/* Clutch Player */}
								<div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
									<div className="flex items-center gap-2 mb-2">
										<HugeiconsIcon icon={Target01Icon} className="size-5 text-blue-500" />
										<h4 className="font-semibold">Clutch Master</h4>
									</div>
									<p className="text-2xl font-bold">
										{p1.closeWins > p2.closeWins ? p1.name : p2.name}
									</p>
									<p className="text-sm text-muted-foreground">Most 1-goal victories</p>
								</div>

								{/* Consistency Award */}
								<div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
									<div className="flex items-center gap-2 mb-2">
										<HugeiconsIcon icon={ActivityIcon} className="size-5 text-green-500" />
										<h4 className="font-semibold">Mr. Consistent</h4>
									</div>
									<p className="text-2xl font-bold">
										{p1.consistencyScore < p2.consistencyScore ? p1.name : p2.name}
									</p>
									<p className="text-sm text-muted-foreground">Most stable performance</p>
								</div>
							</div>

							{/* Peak Performance */}
							<div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<HugeiconsIcon icon={FireIcon} className="size-6 text-purple-500" />
										<div>
											<h4 className="font-semibold">Peak Performance Season</h4>
											<p className="text-sm text-muted-foreground">
												{p1.peakPerformanceSeason && p2.peakPerformanceSeason
													? `${p1.peakPerformanceSeason === p2.peakPerformanceSeason ? "Tie! Both dominated" : p1.highestElo > p2.highestElo ? p1.name : p2.name} in ${p1.highestElo > p2.highestElo ? p1.peakPerformanceSeason : p2.peakPerformanceSeason}`
													: "No peak season data yet"}
											</p>
										</div>
									</div>
									<div className="text-right">
										<p className="text-3xl font-bold text-purple-500">
											{Math.max(p1.highestElo, p2.highestElo)}
										</p>
										<p className="text-xs text-muted-foreground">Highest ELO achieved</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Player Selection Drawer */}
			<Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
				<DrawerContent className="max-h-[85vh]">
					<div className="mx-auto w-full max-w-xl">
						<DrawerHeader className="border-b border-border pb-3">
							<DrawerTitle className="text-sm font-bold font-mono text-center">
								Select Player to Compare
							</DrawerTitle>
						</DrawerHeader>

						<div className="max-h-[55vh] overflow-y-auto">
							{availablePlayers.length === 0 ? (
								<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
									No other players available
								</div>
							) : (
								<div className="flex flex-col">
									{availablePlayers.map((player) => (
										<button
											key={player.id}
											type="button"
											onClick={() => handlePlayerSelect(player.id)}
											className={cn(
												"flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-b-0 hover:bg-muted/50",
												selectedPlayerId === player.id &&
													"bg-primary/10 border-l-2 border-l-primary"
											)}
										>
											<Avatar className="h-10 w-10 rounded-lg">
												<AvatarImage src={player.image ?? undefined} className="rounded-lg" />
												<AvatarFallback className="rounded-lg text-sm">
													{player.name.charAt(0)}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">{player.name}</p>
												<p className="text-xs text-muted-foreground">
													{player.isGuest ? "Guest" : "Member"}
												</p>
											</div>
											{selectedPlayerId === player.id && (
												<HugeiconsIcon icon={Tick01Icon} className="size-4 text-primary shrink-0" />
											)}
										</button>
									))}
								</div>
							)}
						</div>

						<DrawerFooter className="border-t border-border">
							<Button onClick={() => setIsDrawerOpen(false)} className="w-full">
								Done
							</Button>
						</DrawerFooter>
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);
}
