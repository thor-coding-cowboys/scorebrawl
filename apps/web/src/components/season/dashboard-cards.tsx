import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCard } from "./dashboard-card";
import {
	FireIcon,
	SnowIcon,
	BarChartIcon,
	Award01Icon,
	UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { FormDots } from "@/components/ui/form-dots";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

const getAssetUrl = (key: string | null | undefined): string | null => {
	if (!key) return null;
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return key;
	}
	return `/api/user-assets/${key}`;
};

function TeamIcon({ logo, name }: { logo: string | null; name: string }) {
	const [hasError, setHasError] = useState(false);
	const logoUrl = getAssetUrl(logo);

	if (!logoUrl || hasError) {
		return (
			<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10">
				<HugeiconsIcon icon={UserMultipleIcon} className="size-4 text-blue-500" />
			</div>
		);
	}

	return (
		<div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden">
			<img
				src={logoUrl}
				alt={name}
				className="h-full w-full object-cover"
				onError={() => setHasError(true)}
			/>
		</div>
	);
}

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
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-sm font-medium truncate">{data.name}</span>
						<span className="text-xs text-muted-foreground">{data.score} points</span>
					</div>
					{data.form && data.form.length > 0 && <FormDots form={data.form} />}
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No matches yet</div>
			)}
		</DashboardCard>
	);
}

function StrugglingCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: standings } = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));

	// Get lowest scoring player with at least 3 matches
	const strugglingPlayer = standings?.length
		? standings.filter((player) => player.matchCount >= 3).sort((a, b) => a.score - b.score)[0] ||
			null
		: null;

	return (
		<DashboardCard
			title="Struggling"
			icon={SnowIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]"
			iconColor="text-blue-600"
		>
			{!standings ? (
				<Skeleton className="h-12 w-full" />
			) : strugglingPlayer ? (
				<div className="flex items-center gap-3 min-w-0">
					<AvatarWithFallback src={strugglingPlayer.image} name={strugglingPlayer.name} size="md" />
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-sm font-medium truncate">{strugglingPlayer.name}</span>
						<span className="text-xs text-muted-foreground">{strugglingPlayer.score} points</span>
					</div>
					{strugglingPlayer.form && strugglingPlayer.form.length > 0 && (
						<FormDots form={strugglingPlayer.form} />
					)}
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No players with 3+ matches</div>
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
	teamLogo: string | null;
}

function getTeamInfo(players: MatchPlayer[]): { name: string; logo: string | null } | null {
	if (players.length <= 1) return null;
	const teamName = players[0]?.teamName;
	const teamLogo = players[0]?.teamLogo ?? null;
	if (teamName) {
		return { name: teamName, logo: teamLogo };
	}
	const fallbackName = players.map((p) => p.name.split(" ")[0]).join(" & ");
	return { name: fallbackName, logo: teamLogo };
}

function getSideLabel(players: MatchPlayer[]): string {
	if (players.length === 0) return "Unknown";
	const teamInfo = getTeamInfo(players);
	if (teamInfo) {
		return teamInfo.name;
	}
	return players.map((p) => p.name).join(", ");
}

function SideDisplay({ players }: { players: MatchPlayer[] }) {
	const teamInfo = getTeamInfo(players);

	return (
		<div className="flex items-center gap-2 min-w-0">
			<div className="flex gap-1 shrink-0">
				{teamInfo ? (
					<TeamIcon logo={teamInfo.logo} name={teamInfo.name} />
				) : (
					players.map((player) => (
						<AvatarWithFallback key={player.id} src={player.image} name={player.name} size="sm" />
					))
				)}
			</div>
			<span className="text-xs text-muted-foreground truncate">{getSideLabel(players)}</span>
		</div>
	);
}

function LatestMatchCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: latestMatch, isLoading } = useQuery(
		trpc.match.getLatest.queryOptions({ seasonSlug })
	);

	const homePlayers = latestMatch?.players?.filter((p: MatchPlayer) => p.homeTeam) ?? [];
	const awayPlayers = latestMatch?.players?.filter((p: MatchPlayer) => !p.homeTeam) ?? [];

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
				<div className="flex flex-col gap-1.5 min-w-0">
					<div className="flex items-center justify-between gap-2 min-w-0">
						<div className="min-w-0 flex-1">
							<SideDisplay players={homePlayers} />
						</div>
						<span className="text-base font-medium shrink-0">{latestMatch.homeScore}</span>
					</div>
					<div className="flex items-center justify-between gap-2 min-w-0">
						<div className="min-w-0 flex-1">
							<SideDisplay players={awayPlayers} />
						</div>
						<span className="text-base font-medium shrink-0">{latestMatch.awayScore}</span>
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
