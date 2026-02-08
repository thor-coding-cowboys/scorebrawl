import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCard } from "./dashboard-card";
import { FireIcon, SnowIcon, BarChartIcon, Award01Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";

interface DashboardCardsProps {
	seasonSlug: string;
}

function OnFireCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data, isLoading } = useQuery(trpc.seasonPlayer.getTop.queryOptions({ seasonSlug }));

	return (
		<DashboardCard
			title="On Fire"
			icon={FireIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.1),transparent_60%)]"
			iconColor="text-red-600"
		>
			{isLoading ? (
				<Skeleton className="h-12 w-full" />
			) : data ? (
				<div className="flex items-center gap-3 min-w-0">
					<AvatarWithFallback src={data.image} name={data.name} size="md" />
					<div className="flex flex-col min-w-0">
						<span className="text-sm font-medium truncate">{data.name}</span>
						<span className="text-xs text-muted-foreground">{data.score} points</span>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No matches yet</div>
			)}
		</DashboardCard>
	);
}

function StrugglingCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: allPlayers } = useQuery(trpc.seasonPlayer.getAll.queryOptions({ seasonSlug }));

	// Get lowest scoring player as "struggling"
	const strugglingPlayer = allPlayers?.length
		? [...allPlayers].sort((a, b) => a.score - b.score)[0]
		: null;

	return (
		<DashboardCard
			title="Struggling"
			icon={SnowIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]"
			iconColor="text-blue-600"
		>
			{!allPlayers ? (
				<Skeleton className="h-12 w-full" />
			) : strugglingPlayer ? (
				<div className="flex items-center gap-3 min-w-0">
					<AvatarWithFallback src={strugglingPlayer.image} name={strugglingPlayer.name} size="md" />
					<div className="flex flex-col min-w-0">
						<span className="text-sm font-medium truncate">{strugglingPlayer.name}</span>
						<span className="text-xs text-muted-foreground">{strugglingPlayer.score} points</span>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No players</div>
			)}
		</DashboardCard>
	);
}

function InfoCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data, isLoading } = useQuery(trpc.season.getCountInfo.queryOptions({ seasonSlug }));

	return (
		<DashboardCard
			title="General Info"
			icon={BarChartIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]"
			iconColor="text-emerald-600"
		>
			{isLoading ? (
				<Skeleton className="h-12 w-full" />
			) : data ? (
				<div className="grid grid-cols-3 gap-2 text-center">
					<div>
						<div className="text-lg font-bold">{data.matchCount}</div>
						<div className="text-xs text-muted-foreground">Matches</div>
					</div>
					<div>
						<div className="text-lg font-bold">{data.playerCount}</div>
						<div className="text-xs text-muted-foreground">Players</div>
					</div>
					<div>
						<div className="text-lg font-bold">{data.teamCount}</div>
						<div className="text-xs text-muted-foreground">Teams</div>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No data</div>
			)}
		</DashboardCard>
	);
}

interface MatchPlayer {
	id: string;
	seasonPlayerId: string;
	homeTeam: boolean;
	result: "W" | "L" | "D";
	scoreBefore: number;
	scoreAfter: number;
	name: string;
	image: string | null;
	teamName: string | null;
}

function getSideLabel(players: MatchPlayer[]): string {
	if (players.length === 0) return "Unknown";
	const teamNames = players.map((p) => p.teamName).filter(Boolean);
	const uniqueTeams = [...new Set(teamNames)];
	if (uniqueTeams.length === 1 && teamNames.length === players.length) {
		return uniqueTeams[0] ?? "Unknown";
	}
	return players.map((p) => p.name).join(", ");
}

function LatestMatchCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: latestMatch, isLoading } = useQuery(
		trpc.match.getLatest.queryOptions({ seasonSlug })
	);

	return (
		<DashboardCard
			title="Latest Match"
			icon={Award01Icon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),transparent_60%)]"
			iconColor="text-amber-600"
		>
			{isLoading ? (
				<Skeleton className="h-12 w-full" />
			) : latestMatch ? (
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-col gap-1 min-w-0 flex-1">
						<div className="text-sm font-medium truncate">
							{getSideLabel(latestMatch.players?.filter((p: MatchPlayer) => p.homeTeam) ?? [])}
						</div>
						<div className="text-xs text-muted-foreground">vs</div>
						<div className="text-sm font-medium truncate">
							{getSideLabel(latestMatch.players?.filter((p: MatchPlayer) => !p.homeTeam) ?? [])}
						</div>
					</div>
					<div className="text-lg font-bold shrink-0">
						{latestMatch.homeScore} - {latestMatch.awayScore}
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No matches yet</div>
			)}
		</DashboardCard>
	);
}

export function DashboardCards({ seasonSlug }: DashboardCardsProps) {
	const trpc = useTRPC();
	const { data: season } = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));

	const { data: isInSeason } = useQuery(trpc.seasonPlayer.isInSeason.queryOptions({ seasonSlug }));

	const isPointsSeason = season?.scoreType === "3-1-0";

	return (
		<div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
			<OnFireCard seasonSlug={seasonSlug} />
			<StrugglingCard seasonSlug={seasonSlug} />
			{isInSeason && isPointsSeason ? (
				<LatestMatchCard seasonSlug={seasonSlug} />
			) : (
				<InfoCard seasonSlug={seasonSlug} />
			)}
			{!isInSeason || !isPointsSeason ? <LatestMatchCard seasonSlug={seasonSlug} /> : null}
		</div>
	);
}
