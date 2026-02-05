import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCard } from "./dashboard-card";
import { FireIcon, SnowIcon, BarChartIcon, Award01Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";

interface DashboardCardsProps {
	slug: string;
	seasonSlug: string;
}

function OnFireCard({ slug, seasonSlug }: { slug: string; seasonSlug: string }) {
	const { data, isLoading } = useQuery({
		queryKey: ["seasonPlayer", "onFire", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.seasonPlayer.getTop.query({ seasonSlug });
		},
	});

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
				<div className="flex items-center gap-3">
					<AvatarWithFallback src={data.image} name={data.name} size="md" />
					<div className="flex flex-col">
						<span className="text-sm font-medium">{data.name}</span>
						<span className="text-xs text-muted-foreground">{data.score} points</span>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No matches yet</div>
			)}
		</DashboardCard>
	);
}

function StrugglingCard({ slug, seasonSlug }: { slug: string; seasonSlug: string }) {
	const { data: allPlayers } = useQuery({
		queryKey: ["seasonPlayer", "all", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.seasonPlayer.getAll.query({ seasonSlug });
		},
	});

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
				<div className="flex items-center gap-3">
					<AvatarWithFallback src={strugglingPlayer.image} name={strugglingPlayer.name} size="md" />
					<div className="flex flex-col">
						<span className="text-sm font-medium">{strugglingPlayer.name}</span>
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
	const { data, isLoading } = useQuery({
		queryKey: ["season", "countInfo", seasonSlug],
		queryFn: async () => {
			return await trpcClient.season.getCountInfo.query({ seasonSlug });
		},
	});

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
}

interface MatchWithPlayers {
	id: string;
	seasonId: string;
	homeScore: number;
	awayScore: number;
	createdAt: Date;
	players: MatchPlayer[];
}

function LatestMatchCard({ slug, seasonSlug }: { slug: string; seasonSlug: string }) {
	const { data: latestMatch, isLoading } = useQuery<MatchWithPlayers | null>({
		queryKey: ["match", "latest", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.match.getLatest.query({ seasonSlug });
		},
	});

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
				<div className="flex items-center justify-between">
					<div className="flex flex-col gap-1">
						<div className="text-sm font-medium">
							{latestMatch.players
								?.filter((p: MatchPlayer) => p.homeTeam)
								.map((p: MatchPlayer) => p.name)
								.join(", ")}
						</div>
						<div className="text-xs text-muted-foreground">vs</div>
						<div className="text-sm font-medium">
							{latestMatch.players
								?.filter((p: MatchPlayer) => !p.homeTeam)
								.map((p: MatchPlayer) => p.name)
								.join(", ")}
						</div>
					</div>
					<div className="text-lg font-bold">
						{latestMatch.homeScore} - {latestMatch.awayScore}
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No matches yet</div>
			)}
		</DashboardCard>
	);
}

export function DashboardCards({ slug, seasonSlug }: DashboardCardsProps) {
	const { data: season } = useQuery({
		queryKey: ["season", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.season.getBySlug.query({ seasonSlug });
		},
	});

	const { data: isInSeason } = useQuery({
		queryKey: ["seasonPlayer", "isInSeason", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.seasonPlayer.isInSeason.query({ seasonSlug });
		},
	});

	const isPointsSeason = season?.scoreType === "3-1-0";

	return (
		<div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
			<OnFireCard slug={slug} seasonSlug={seasonSlug} />
			<StrugglingCard slug={slug} seasonSlug={seasonSlug} />
			{isInSeason && isPointsSeason ? (
				<LatestMatchCard slug={slug} seasonSlug={seasonSlug} />
			) : (
				<InfoCard seasonSlug={seasonSlug} />
			)}
			{!isInSeason || !isPointsSeason ? (
				<LatestMatchCard slug={slug} seasonSlug={seasonSlug} />
			) : null}
		</div>
	);
}
