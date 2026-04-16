import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { z } from "zod";

const compareSearchSchema = z.object({
	p1: z.string().optional(),
	p2: z.string().optional(),
	season: z.string().optional(),
});
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useTRPC } from "@/lib/trpc";
import { truncateSlug, cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ActivityIcon,
	CrownIcon,
	ChartBarLineIcon,
	GitCompareIcon,
	Medal01Icon,
	Clock01Icon,
	ChartLineData01Icon,
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

function StatComparison({
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
}) {
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
}

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/players/compare")({
	component: PlayerComparisonPage,
	validateSearch: compareSearchSchema,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

function PlayerComparisonPage() {
	const { slug } = Route.useLoaderData();
	const navigate = useNavigate({ from: Route.fullPath });
	const trpc = useTRPC();
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [drawerFocus, setDrawerFocus] = useState<"p1" | "p2">("p1");

	const { p1: player1Id, p2: player2Id, season: selectedSeasonId } = Route.useSearch();

	const setSelectedSeasonId = (id: string | undefined) => {
		navigate({ to: ".", search: (prev) => ({ ...prev, season: id }) });
	};

	const setPlayer2Id = (id: string | undefined) => {
		navigate({ to: ".", search: (prev) => ({ ...prev, p2: id }) });
	};

	// Get all players for selection
	const { data: allPlayers, isLoading: playersLoading } = useQuery(
		trpc.player.getAll.queryOptions()
	);

	// Get available seasons
	const { data: seasons } = useQuery(trpc.season.getAll.queryOptions());

	// Get comparison data only when both players are selected
	const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
		...trpc.player.comparePlayers.queryOptions({
			player1Id: player1Id ?? "",
			player2Id: player2Id ?? "",
			seasonId: selectedSeasonId,
		}),
		enabled: !!player1Id && !!player2Id && player1Id !== player2Id,
	});

	// Get season history for both players for charts
	const { data: player1History } = useQuery({
		...trpc.player.getSeasonHistory.queryOptions({
			playerId: player1Id ?? "",
			seasonId: selectedSeasonId,
		}),
		enabled: !!player1Id,
	});

	const { data: player2History } = useQuery({
		...trpc.player.getSeasonHistory.queryOptions({
			playerId: player2Id ?? "",
			seasonId: selectedSeasonId,
		}),
		enabled: !!player2Id,
	});

	const p1 = comparisonData?.player1;
	const p2 = comparisonData?.player2;
	const h2h = comparisonData?.headToHead;

	const setPlayer1Id = (id: string | undefined) => {
		navigate({ to: ".", search: (prev) => ({ ...prev, p1: id }) });
	};

	// Get basic info for both players
	const player1Basic = allPlayers?.find((p) => p.id === player1Id);
	const player2Basic = allPlayers?.find((p) => p.id === player2Id);

	// Prepare chart data
	const combinedSeasonData = useMemo(() => {
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
	}, [player1History, player2History, p1?.name, p2?.name]);

	const radarData = useMemo(
		() => [
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
		],
		[p1, p2]
	);

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
						{/* Season Filter */}
						<div className="mb-4">
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
						<div className="flex flex-col sm:flex-row items-center gap-4">
							{/* Player 1 Selector */}
							<div className="flex-1 w-full">
								{playersLoading ? (
									<Skeleton className="h-14 w-full" />
								) : player1Basic ? (
									<button
										type="button"
										onClick={() => {
											setDrawerFocus("p1");
											setIsDrawerOpen(true);
										}}
										className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
									>
										<Avatar className="h-12 w-12 rounded-lg">
											<AvatarImage src={player1Basic.image ?? undefined} className="rounded-lg" />
											<AvatarFallback className="rounded-lg text-lg">
												{player1Basic.name.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<p className="font-semibold">{player1Basic.name}</p>
											<p className="text-sm text-muted-foreground">Player 1 (click to change)</p>
										</div>
										<HugeiconsIcon icon={GitCompareIcon} className="size-4 text-muted-foreground" />
									</button>
								) : (
									<button
										type="button"
										onClick={() => {
											setDrawerFocus("p1");
											setIsDrawerOpen(true);
										}}
										className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
									>
										<HugeiconsIcon icon={UserAdd01Icon} className="size-5" />
										<span className="font-medium">Select Player 1</span>
									</button>
								)}
							</div>

							<div className="text-muted-foreground">
								<HugeiconsIcon icon={GitCompareIcon} className="size-6" />
							</div>

							{/* Player 2 Selector - Opens Drawer */}
							<div className="flex-1 w-full">
								{playersLoading ? (
									<Skeleton className="h-14 w-full" />
								) : player2Id && player2Basic ? (
									<button
										type="button"
										onClick={() => {
											setDrawerFocus("p2");
											setIsDrawerOpen(true);
										}}
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
										onClick={() => {
											setDrawerFocus("p2");
											setIsDrawerOpen(true);
										}}
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

				{player1Id && player2Id && player1Id === player2Id && (
					<div className="text-sm text-muted-foreground text-center p-2">
						Please select two different players to compare.
					</div>
				)}

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
												{player1Basic?.name?.charAt(0) ?? "P"}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<h2 className="text-2xl font-bold">{player1Basic?.name ?? "Player 1"}</h2>
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
									<LineChart data={combinedSeasonData}>
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
			</div>

			<PlayerSelectionDrawer
				isOpen={isDrawerOpen}
				onClose={() => setIsDrawerOpen(false)}
				players={allPlayers ?? []}
				player1Id={player1Id}
				player2Id={player2Id}
				onSelectPlayer1={setPlayer1Id}
				onSelectPlayer2={setPlayer2Id}
				initialFocus={drawerFocus}
			/>
		</>
	);
}

function PlayerSelectionDrawer({
	isOpen,
	onClose,
	players,
	player1Id,
	player2Id,
	onSelectPlayer1,
	onSelectPlayer2,
	initialFocus,
}: {
	isOpen: boolean;
	onClose: () => void;
	players: { id: string; name: string; image: string | null; isGuest: boolean }[];
	player1Id: string | undefined;
	player2Id: string | undefined;
	onSelectPlayer1: (id: string | undefined) => void;
	onSelectPlayer2: (id: string | undefined) => void;
	initialFocus: "p1" | "p2";
}) {
	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DrawerContent className="max-h-[85vh]">
				<div className="mx-auto w-full max-w-xl">
					<DrawerHeader className="border-b border-border pb-3">
						<DrawerTitle className="text-sm font-bold font-mono text-center">
							Select Players
						</DrawerTitle>
					</DrawerHeader>

					<div className="grid grid-cols-2 gap-0 max-h-[55vh] overflow-y-auto">
						{/* Player 1 Column */}
						<div className="border-r border-border">
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span
									className={cn(
										"text-xs font-mono font-medium uppercase tracking-wider",
										initialFocus === "p1" ? "text-blue-500" : "text-blue-500/50"
									)}
								>
									Player 1
								</span>
							</div>
							<ComparePlayerList
								players={players}
								side="p1"
								player1Id={player1Id}
								player2Id={player2Id}
								onSelect={(id) => {
									if (player2Id === id) onSelectPlayer2(undefined);
									onSelectPlayer1(player1Id === id ? undefined : id);
								}}
							/>
						</div>

						{/* Player 2 Column */}
						<div>
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span
									className={cn(
										"text-xs font-mono font-medium uppercase tracking-wider",
										initialFocus === "p2" ? "text-rose-500" : "text-rose-500/50"
									)}
								>
									Player 2
								</span>
							</div>
							<ComparePlayerList
								players={players}
								side="p2"
								player1Id={player1Id}
								player2Id={player2Id}
								onSelect={(id) => {
									if (player1Id === id) onSelectPlayer1(undefined);
									onSelectPlayer2(player2Id === id ? undefined : id);
								}}
							/>
						</div>
					</div>

					<DrawerFooter className="border-t border-border">
						<Button onClick={onClose} className="w-full">
							Done
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

function ComparePlayerList({
	players,
	side,
	player1Id,
	player2Id,
	onSelect,
}: {
	players: { id: string; name: string; image: string | null; isGuest: boolean }[];
	side: "p1" | "p2";
	player1Id: string | undefined;
	player2Id: string | undefined;
	onSelect: (id: string) => void;
}) {
	return (
		<div className="flex flex-col">
			{players.map((player) => {
				const isThisSide = side === "p1" ? player.id === player1Id : player.id === player2Id;
				const isOtherSide = side === "p1" ? player.id === player2Id : player.id === player1Id;

				return (
					<button
						key={player.id}
						type="button"
						onClick={() => onSelect(player.id)}
						className={cn(
							"flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/50 last:border-b-0",
							isThisSide && side === "p1" && "bg-blue-500/10 border-l-2 border-l-blue-500",
							isThisSide && side === "p2" && "bg-rose-500/10 border-l-2 border-l-rose-500",
							isOtherSide && "opacity-40 line-through",
							!isThisSide && !isOtherSide && "hover:bg-muted/50"
						)}
					>
						<Avatar className="h-9 w-9 rounded-lg shrink-0">
							<AvatarImage src={player.image ?? undefined} className="rounded-lg" />
							<AvatarFallback className="rounded-lg text-sm">
								{player.name.charAt(0)}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium truncate">{player.name}</p>
							<p className="text-[0.65rem] text-muted-foreground">
								{player.isGuest ? "Guest" : "Member"}
							</p>
						</div>
						{isThisSide && (
							<HugeiconsIcon
								icon={Tick01Icon}
								className={cn(
									"size-3.5 shrink-0",
									side === "p1" ? "text-blue-500" : "text-rose-500"
								)}
							/>
						)}
					</button>
				);
			})}
			{players.length === 0 && (
				<div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
					No players available
				</div>
			)}
		</div>
	);
}
