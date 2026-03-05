import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTRPC, type RouterOutput } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from "recharts";
import {
	Target01Icon,
	Clock01Icon,
	UserMultipleIcon,
	Crown02Icon,
} from "@hugeicons/core-free-icons";
import { DashboardCard } from "../../../-components/season/dashboard-card";
import { OverviewCard } from "../../../-components/season/overview-card";
import { useCarousel } from "@/hooks/use-carousel";
import { cn, formatDuration, rotationLabel, truncateSlug } from "@/lib/utils";

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/summary"
)({
	component: SessionSummaryPage,
});

type SessionSummary = RouterOutput["session"]["getSummary"];
type PlayerSummary = SessionSummary["playerStats"][number];
type TeamCombo = SessionSummary["teamCombos"][number];
type MatchFeedItem = SessionSummary["matchFeed"][number];
type MatchFeedPlayer = MatchFeedItem["homePlayers"][number];

function formatDate(d: Date | null | undefined): string {
	if (!d) return "—";
	return new Date(d).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

const matchResultsConfig = {
	wins: { label: "Wins", color: "#22c55e" },
	losses: { label: "Losses", color: "#ef4444" },
	draws: { label: "Draws", color: "#6b7280" },
} satisfies ChartConfig;

function SessionSummaryPage() {
	const { slug, seasonSlug, sessionId } = Route.useParams();
	const trpc = useTRPC();

	const {
		data: summary,
		isLoading,
		isError,
		error,
	} = useQuery(trpc.session.getSummary.queryOptions({ sessionId }));

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
				Loading summary...
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
				Failed to load summary: {error?.message || "Unknown error"}
			</div>
		);
	}

	if (!summary) {
		return (
			<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
				Summary not found.
			</div>
		);
	}

	const sorted = [...summary.playerStats].sort((a, b) => b.wins - a.wins);
	const mvp = sorted[0];

	const barChartData = sorted.map((p) => ({
		name: p.displayName.split(" ")[0],
		wins: p.wins,
		losses: p.losses,
		draws: p.draws,
	}));

	const eloConfig: ChartConfig = {};
	for (const p of summary.playerStats) {
		eloConfig[p.seasonPlayerId] = {
			label: p.displayName.split(" ")[0] ?? p.displayName,
			color: `var(--chart-${(summary.playerStats.indexOf(p) % 5) + 1})`,
		};
	}

	const eloChartData = summary.eloProgression.map((ep) => ({
		match: `#${ep.matchNumber}`,
		...ep.scores,
	}));

	const allEloScores = summary.eloProgression.flatMap((ep) => Object.values(ep.scores));
	const eloMin =
		allEloScores.length > 0 ? Math.floor((Math.min(...allEloScores) - 20) / 10) * 10 : 0;
	const eloMax =
		allEloScores.length > 0 ? Math.ceil((Math.max(...allEloScores) + 20) / 10) * 10 : 100;

	const bestCombo = summary.teamCombos[0];
	const worstCombo =
		summary.teamCombos.length > 1
			? [...summary.teamCombos].sort((a, b) => a.winRate - b.winRate || a.games - b.games)[0]
			: undefined;

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Seasons", href: `/leagues/${slug}/seasons` },
					{
						name: truncateSlug(seasonSlug),
						href: `/leagues/${slug}/seasons/${seasonSlug}`,
					},
					{ name: "Session Summary" },
				]}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<SummaryDashboardCards
					summary={summary}
					mvp={mvp}
					bestCombo={bestCombo}
					worstCombo={worstCombo}
				/>

				<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
					<div className="flex flex-col gap-4">
						<OverviewCard title="Player Standings">
							<div className="space-y-1.5">
								{sorted.map((player, i) => {
									const eloDelta =
										player.scoreBeforeSession != null && player.scoreAfterSession != null
											? player.scoreAfterSession - player.scoreBeforeSession
											: null;
									return (
										<div key={player.seasonPlayerId} className="flex items-center gap-3 py-1.5">
											<span className="text-xs text-muted-foreground w-5 text-right tabular-nums">
												{i + 1}
											</span>
											<AvatarWithFallback
												src={player.playerImage}
												name={player.displayName}
												size="sm"
											/>
											<div className="flex-1 min-w-0">
												<span className="text-sm font-medium truncate block">
													{player.displayName}
												</span>
											</div>
											<div className="flex items-center gap-3 text-xs tabular-nums">
												<span className="text-muted-foreground">
													{player.gamesPlayedThisSession}G
												</span>
												<span className="text-emerald-600">{player.wins}W</span>
												<span className="text-red-500">{player.losses}L</span>
												{player.draws > 0 && (
													<span className="text-muted-foreground">{player.draws}D</span>
												)}
												{eloDelta != null && (
													<span
														className={
															eloDelta >= 0
																? "text-emerald-600 font-medium"
																: "text-red-500 font-medium"
														}
													>
														{eloDelta > 0 ? "+" : ""}
														{eloDelta}
													</span>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</OverviewCard>

						{summary.matchFeed.length > 0 && (
							<OverviewCard title="Match-by-Match">
								<div className="divide-y divide-border">
									{summary.matchFeed.map((m) => {
										const homeWins = m.homeScore > m.awayScore;
										const awayWins = m.awayScore > m.homeScore;
										return (
											<div key={m.matchNumber} className="py-3 first:pt-0 last:pb-0">
												<div className="flex items-center gap-2 mb-2">
													<span className="text-xs font-medium text-muted-foreground">
														#{m.matchNumber}
													</span>
												</div>
												<div className="flex flex-col gap-2">
													<MatchSide
														players={m.homePlayers}
														score={m.homeScore}
														isWinner={homeWins}
														isMuted={awayWins}
													/>
													<MatchSide
														players={m.awayPlayers}
														score={m.awayScore}
														isWinner={awayWins}
														isMuted={homeWins}
													/>
												</div>
											</div>
										);
									})}
								</div>
							</OverviewCard>
						)}
					</div>

					<div className="flex flex-col gap-4">
						{barChartData.length > 0 && (
							<OverviewCard title="Win / Loss / Draw">
								<ChartContainer config={matchResultsConfig} className="h-[250px] w-full">
									<BarChart data={barChartData}>
										<CartesianGrid vertical={false} strokeDasharray="3 3" />
										<XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
										<YAxis tickLine={false} axisLine={false} allowDecimals={false} />
										<ChartTooltip content={<ChartTooltipContent />} />
										<ChartLegend content={<ChartLegendContent />} />
										<Bar dataKey="wins" fill="var(--color-wins)" radius={[4, 4, 0, 0]} />
										<Bar dataKey="losses" fill="var(--color-losses)" radius={[4, 4, 0, 0]} />
										<Bar dataKey="draws" fill="var(--color-draws)" radius={[4, 4, 0, 0]} />
									</BarChart>
								</ChartContainer>
							</OverviewCard>
						)}

						{eloChartData.length > 1 && (
							<OverviewCard title="ELO Progression">
								<ChartContainer config={eloConfig} className="h-[300px] w-full">
									<LineChart data={eloChartData}>
										<CartesianGrid vertical={false} strokeDasharray="3 3" />
										<XAxis dataKey="match" tickLine={false} axisLine={false} tickMargin={8} />
										<YAxis tickLine={false} axisLine={false} domain={[eloMin, eloMax]} />
										<ChartTooltip content={<ChartTooltipContent />} />
										<ChartLegend content={<ChartLegendContent />} />
										{summary.playerStats.map((p) => (
											<Line
												key={p.seasonPlayerId}
												type="monotone"
												dataKey={p.seasonPlayerId}
												stroke={`var(--color-${p.seasonPlayerId})`}
												strokeWidth={2}
												dot={{ fill: `var(--color-${p.seasonPlayerId})`, r: 3 }}
												connectNulls
											/>
										))}
									</LineChart>
								</ChartContainer>
							</OverviewCard>
						)}
					</div>
				</div>
			</div>
		</>
	);
}

function SummaryDashboardCards({
	summary,
	mvp,
	bestCombo,
	worstCombo,
}: {
	summary: SessionSummary;
	mvp: PlayerSummary | undefined;
	bestCombo: TeamCombo | undefined;
	worstCombo: TeamCombo | undefined;
}) {
	const { scrollRef, containerStyle, onTouchStart, onTouchEnd, onScroll, activeIndex } =
		useCarousel(4);

	const comboNames = (combo: TeamCombo) =>
		combo.players.map((p) => p.displayName.split(" ")[0]).join(" & ");

	const cards = [
		<DashboardCard
			key="session"
			title="Session"
			icon={Clock01Icon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]"
			iconColor="text-blue-600"
		>
			<div className="text-lg font-bold">{formatDate(summary.createdAt)}</div>
			<p className="text-xs text-muted-foreground">
				{formatDuration(summary.createdAt, summary.endedAt)} · {rotationLabel(summary.rotationMode)}
			</p>
		</DashboardCard>,
		<DashboardCard
			key="matches"
			title="Matches"
			icon={Target01Icon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]"
			iconColor="text-emerald-600"
		>
			<div className="text-2xl font-bold">{summary.totalMatches}</div>
			<p className="text-xs text-muted-foreground">{summary.playerStats.length} players</p>
		</DashboardCard>,
		mvp ? (
			<DashboardCard
				key="mvp"
				title="MVP"
				icon={Crown02Icon}
				glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(234,179,8,0.12),transparent_60%)]"
				iconColor="text-yellow-600"
			>
				<div className="flex items-center gap-2 min-w-0">
					<AvatarWithFallback src={mvp.playerImage} name={mvp.displayName} size="md" />
					<div className="min-w-0">
						<div className="text-sm font-bold truncate">{mvp.displayName}</div>
						<p className="text-xs text-muted-foreground">
							{mvp.wins}W · {mvp.gamesPlayedThisSession}G
						</p>
					</div>
				</div>
			</DashboardCard>
		) : (
			<DashboardCard
				key="mvp"
				title="MVP"
				icon={Crown02Icon}
				glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(234,179,8,0.12),transparent_60%)]"
				iconColor="text-yellow-600"
			>
				<div className="text-sm text-muted-foreground">No matches played</div>
			</DashboardCard>
		),
		<DashboardCard
			key="teams"
			title="Teams"
			icon={UserMultipleIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(168,85,247,0.1),transparent_60%)]"
			iconColor="text-purple-600"
		>
			{bestCombo ? (
				<div className="space-y-1.5">
					<div className="flex items-center justify-between gap-2">
						<span className="text-sm font-medium truncate">{comboNames(bestCombo)}</span>
						<span className="text-xs font-medium text-emerald-600 shrink-0">
							{bestCombo.winRate}%
						</span>
					</div>
					{worstCombo &&
						worstCombo.players.map((p) => p.seasonPlayerId).join("|") !==
							bestCombo.players.map((p) => p.seasonPlayerId).join("|") && (
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm text-muted-foreground truncate">
									{comboNames(worstCombo)}
								</span>
								<span className="text-xs font-medium text-red-500 shrink-0">
									{worstCombo.winRate}%
								</span>
							</div>
						)}
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No team data</div>
			)}
		</DashboardCard>,
	];

	return (
		<>
			<div className="md:hidden overflow-hidden">
				<div
					ref={scrollRef}
					className="flex items-stretch snap-x snap-mandatory overflow-x-auto"
					style={containerStyle}
					onTouchStart={onTouchStart}
					onTouchEnd={onTouchEnd}
					onScroll={onScroll}
				>
					{cards.map((card, i) => (
						<div key={i} className="snap-start shrink-0 w-full">
							{card}
						</div>
					))}
				</div>
				<div className="flex justify-center gap-1.5 mt-2">
					{cards.map((_, i) => (
						<div
							key={i}
							className={cn(
								"h-1.5 rounded-full transition-all duration-200",
								i === activeIndex ? "w-4 bg-foreground" : "w-1.5 bg-muted-foreground/30"
							)}
						/>
					))}
				</div>
			</div>
			<div className="hidden md:grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards}</div>
		</>
	);
}

function MatchSide({
	players,
	score,
	isWinner,
	isMuted,
}: {
	players: MatchFeedPlayer[];
	score: number;
	isWinner: boolean;
	isMuted: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-2 min-w-0">
			<div className="flex items-center gap-2 min-w-0">
				<div className="flex gap-1 shrink-0">
					{players.map((p) => (
						<AvatarWithFallback
							key={p.seasonPlayerId}
							src={p.playerImage}
							name={p.displayName}
							size="sm"
						/>
					))}
				</div>
				<span
					className={
						isWinner
							? "text-sm font-semibold text-foreground truncate"
							: isMuted
								? "text-sm text-muted-foreground truncate"
								: "text-sm text-foreground truncate"
					}
				>
					{players.map((p) => p.displayName.split(" ")[0]).join(" & ")}
				</span>
			</div>
			<div
				className={cn(
					"flex h-7 w-7 items-center justify-center border text-sm tabular-nums shrink-0 bg-primary/10",
					isWinner
						? "font-bold text-foreground"
						: isMuted
							? "text-muted-foreground font-medium"
							: "font-medium text-foreground"
				)}
			>
				{score}
			</div>
		</div>
	);
}
