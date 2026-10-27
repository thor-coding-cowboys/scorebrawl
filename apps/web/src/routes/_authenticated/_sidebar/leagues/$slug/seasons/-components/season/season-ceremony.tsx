import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	Add01Icon,
	ChartIncreaseIcon,
	CrownIcon,
	FireIcon,
	FlashIcon,
	GameController01Icon,
	Medal01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CreateSeasonForm } from "../seasons/create-season-form";
import { DashboardCard } from "./dashboard-card";
import { OverviewCard } from "./overview-card";

type Summary = RouterOutput["season"]["getSummary"];

interface PodiumEntry {
	id: string;
	rank: number;
	name: string;
	image: string | null;
	score: number;
	matchCount: number;
	winRate: number;
}

const placeStyles: Record<number, { order: string; height: string; medal: string; ring: string }> =
	{
		1: {
			order: "sm:order-2",
			height: "sm:min-h-44",
			medal: "text-amber-500",
			ring: "border-amber-500/40 card-glow-amber",
		},
		2: {
			order: "sm:order-1",
			height: "sm:min-h-36",
			medal: "text-slate-400",
			ring: "border-slate-400/40",
		},
		3: {
			order: "sm:order-3",
			height: "sm:min-h-32",
			medal: "text-orange-700",
			ring: "border-orange-700/40",
		},
	};

function Podium({ title, entries }: { title: string; entries: PodiumEntry[] }) {
	return (
		<OverviewCard title={title}>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
				{entries.map((entry) => {
					const style = placeStyles[entry.rank] ?? placeStyles[3];
					return (
						<div
							key={entry.id}
							data-testid={`podium-place-${entry.rank}`}
							className={cn(
								"relative flex items-center gap-3 border p-3 sm:flex-col sm:justify-end sm:gap-2 sm:p-4 sm:text-center",
								style.ring,
								style.height,
								style.order
							)}
						>
							<div className="flex w-10 shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground sm:w-auto">
								<HugeiconsIcon icon={Medal01Icon} className={cn("size-4", style.medal)} />#
								{entry.rank}
							</div>
							<AvatarWithFallback
								src={entry.image}
								name={entry.name}
								size={entry.rank === 1 ? "xl" : "lg"}
							/>
							<div className="flex min-w-0 flex-1 flex-col sm:max-w-full sm:flex-none sm:items-center sm:gap-1">
								<span className="truncate text-sm font-medium">{entry.name}</span>
								<span className="text-xs text-muted-foreground">
									{entry.matchCount} matches • {entry.winRate}% wins
								</span>
							</div>
							<span className="text-lg font-bold">{entry.score}</span>
						</div>
					);
				})}
			</div>
		</OverviewCard>
	);
}

function ChampionBanner({
	summary,
	canStartNextSeason,
	onStartNextSeason,
}: {
	summary: Summary;
	canStartNextSeason: boolean;
	onStartNextSeason: () => void;
}) {
	const champion = summary.podium[0];
	const names = summary.champions.map((c) => c.name).join(" & ");
	return (
		<Card
			className="relative overflow-hidden border border-amber-500/30"
			data-testid="champion-banner"
		>
			<div className="absolute inset-0 card-glow-amber" />
			<div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-4 min-w-0">
					{champion && <AvatarWithFallback src={champion.image} name={champion.name} size="xl" />}
					<div className="flex min-w-0 flex-col gap-1">
						<div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-600">
							<HugeiconsIcon icon={CrownIcon} className="size-4" />
							{summary.champions.length > 1 ? "Season Co-Champions" : "Season Champion"}
						</div>
						<span className="truncate text-2xl font-bold">{names || "No champion"}</span>
						<span className="text-xs text-muted-foreground">
							{champion && summary.champions.length > 0
								? `${champion.score} points • ${champion.matchCount} matches • ${champion.winRate}% win rate`
								: "No matches were played this season"}
						</span>
					</div>
				</div>
				{canStartNextSeason && (
					<Button
						size="sm"
						className="gap-1.5 self-start sm:self-center"
						onClick={onStartNextSeason}
						data-testid="start-next-season-button"
					>
						<HugeiconsIcon icon={Add01Icon} className="size-4" />
						Start next season
					</Button>
				)}
			</div>
		</Card>
	);
}

function Highlights({ highlights }: { highlights: Summary["highlights"] }) {
	const { longestWinStreak, biggestUpset, biggestGain, mostMatches } = highlights;
	const items = [
		longestWinStreak && {
			title: "Longest Streak",
			icon: FireIcon,
			glowColor: "card-glow-red",
			iconColor: "text-red-600",
			player: longestWinStreak.player,
			detail: `${longestWinStreak.length} wins in a row`,
		},
		biggestUpset && {
			title: "Biggest Upset",
			icon: FlashIcon,
			glowColor: "card-glow-purple",
			iconColor: "text-purple-600",
			player: biggestUpset.winners[0],
			label: biggestUpset.winners.map((p) => p.name).join(" & "),
			detail: `${biggestUpset.winnerScore}–${biggestUpset.loserScore} vs ${biggestUpset.losers.map((p) => p.name).join(" & ")} (${Math.round(biggestUpset.winnerOdds * 100)}% odds)`,
		},
		biggestGain && {
			title: "Biggest Gain",
			icon: ChartIncreaseIcon,
			glowColor: "card-glow-emerald",
			iconColor: "text-emerald-600",
			player: biggestGain.player,
			detail: `+${biggestGain.gain} points in one match`,
		},
		mostMatches && {
			title: "Most Matches",
			icon: GameController01Icon,
			glowColor: "card-glow-blue",
			iconColor: "text-blue-600",
			player: mostMatches.player,
			detail: `${mostMatches.matchCount} matches played`,
		},
	].filter((item) => !!item);

	if (items.length === 0) return null;

	return (
		<div className="flex flex-col gap-2" data-testid="season-highlights">
			<h3 className="text-sm font-medium text-muted-foreground">Biggest moments</h3>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{items.map((item) => (
					<DashboardCard
						key={item.title}
						title={item.title}
						icon={item.icon}
						glowColor={item.glowColor}
						iconColor={item.iconColor}
					>
						<div className="flex items-center gap-3 min-w-0">
							{item.player && (
								<AvatarWithFallback src={item.player.image} name={item.player.name} size="md" />
							)}
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-sm font-medium">
									{"label" in item ? item.label : item.player?.name}
								</span>
								<span className="text-xs text-muted-foreground">{item.detail}</span>
							</div>
						</div>
					</DashboardCard>
				))}
			</div>
		</div>
	);
}

export function SeasonCeremony({
	seasonSlug,
	leagueSlug,
	canStartNextSeason,
}: {
	seasonSlug: string;
	leagueSlug: string;
	canStartNextSeason: boolean;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));

	if (!summary) return <Skeleton className="h-32 w-full" />;

	return (
		<div className="flex flex-col gap-4" data-testid="season-ceremony">
			<ChampionBanner
				summary={summary}
				canStartNextSeason={canStartNextSeason}
				onStartNextSeason={() => setIsCreateOpen(true)}
			/>
			{summary.matchCount > 0 && (
				<>
					<div className={cn("grid gap-4", summary.teamPodium.length > 0 && "lg:grid-cols-2")}>
						<Podium title="Player Podium" entries={summary.podium} />
						{summary.teamPodium.length > 0 && (
							<Podium
								title="Team Podium"
								entries={summary.teamPodium.map((t) => ({ ...t, image: t.logo }))}
							/>
						)}
					</div>
					<Highlights highlights={summary.highlights} />
				</>
			)}
			{canStartNextSeason && (
				<CreateSeasonForm
					isOpen={isCreateOpen}
					onClose={() => setIsCreateOpen(false)}
					onSuccess={(newSeasonSlug) => {
						void navigate({
							to: "/leagues/$slug/seasons/$seasonSlug",
							params: { slug: leagueSlug, seasonSlug: newSeasonSlug },
						});
					}}
				/>
			)}
		</div>
	);
}
