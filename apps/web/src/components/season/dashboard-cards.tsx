import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCard } from "./dashboard-card";
import {
	FireIcon,
	SnowIcon,
	BarChartIcon,
	Award01Icon,
	UserMultipleIcon,
	Calendar03Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { FormDots } from "@/components/ui/form-dots";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Add01Icon,
	MinusSignIcon,
	Tick01Icon,
	Cancel01Icon,
	PencilEdit01Icon,
} from "hugeicons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
				<div className="space-y-2 min-w-0">
					<div className="flex items-center gap-3 min-w-0">
						<div className="min-w-0 flex-1">
							<SideDisplay players={homePlayers} />
						</div>
						<div className="flex h-7 w-7 items-center justify-center rounded-md border text-sm font-medium shrink-0 bg-primary/10">
							{latestMatch.homeScore}
						</div>
					</div>
					<div className="flex items-center gap-3 min-w-0">
						<div className="min-w-0 flex-1">
							<SideDisplay players={awayPlayers} />
						</div>
						<div className="flex h-7 w-7 items-center justify-center rounded-md border text-sm font-medium shrink-0 bg-primary/10">
							{latestMatch.awayScore}
						</div>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No matches yet</div>
			)}
		</DashboardCard>
	);
}

interface Fixture {
	id: string;
	seasonId: string;
	round: number;
	matchId: string | null;
	homePlayerId: string;
	awayPlayerId: string;
}

interface SeasonPlayer {
	id: string;
	name: string;
	image: string | null;
}

function ScoreStepper({ score, setScore }: { score: number; setScore: (score: number) => void }) {
	return (
		<div className="flex items-center gap-1">
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 shrink-0 rounded-full transition-transform active:scale-75"
				onClick={() => setScore(Math.max(score - 1, 0))}
				type="button"
			>
				<MinusSignIcon className="h-3.5 w-3.5" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 shrink-0 rounded-full transition-transform active:scale-75"
				onClick={() => setScore(score + 1)}
				type="button"
			>
				<Add01Icon className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

function NextMatchCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isEditing, setIsEditing] = useState(false);
	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);

	const { data: fixtures, isLoading: fixturesLoading } = useQuery(
		trpc.season.getFixtures.queryOptions({ seasonSlug })
	);

	const { data: players } = useQuery(trpc.seasonPlayer.getAll.queryOptions({ seasonSlug }));

	const { mutate: createFromFixture, isPending } = useMutation({
		mutationFn: async (data: {
			seasonSlug: string;
			homeScore: number;
			awayScore: number;
			fixtureId: string;
		}) => {
			return await trpcClient.match.createFromFixture.mutate(data);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: trpc.season.getFixtures.queryKey({ seasonSlug }),
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.match.getLatest.queryKey({ seasonSlug }),
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getTop.queryKey({ seasonSlug }),
			});
			setIsEditing(false);
			setHomeScore(0);
			setAwayScore(0);
			toast.success("Match logged");
		},
		onError: () => {
			toast.error("Failed to log match");
		},
	});

	const nextFixture = fixtures?.find((f: Fixture) => !f.matchId);
	const homePlayer = players?.find((p: SeasonPlayer) => p.id === nextFixture?.homePlayerId);
	const awayPlayer = players?.find((p: SeasonPlayer) => p.id === nextFixture?.awayPlayerId);

	const getFirstName = (name: string) => name.split(" ")[0];

	return (
		<DashboardCard
			title="Next Match"
			icon={Calendar03Icon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]"
			iconColor="text-emerald-600"
		>
			{fixturesLoading ? (
				<Skeleton className="h-12 w-full" />
			) : nextFixture && homePlayer && awayPlayer ? (
				<div className="flex items-center gap-3 min-w-0">
					<div className="flex-1 min-w-0">
						<div className="space-y-2">
							<div className="flex items-center gap-3">
								<AvatarWithFallback src={homePlayer.image} name={homePlayer.name} size="sm" />
								<span className="text-sm flex-1 truncate min-w-0">
									{getFirstName(homePlayer.name)}
								</span>
								<div className="flex items-center gap-2 shrink-0">
									<div
										className={cn(
											"flex h-7 w-7 items-center justify-center rounded-md border text-sm font-medium shrink-0 transition-all duration-200",
											isEditing && "bg-primary/10 scale-110 ring-2 ring-primary/20"
										)}
									>
										{isEditing ? homeScore : ""}
									</div>
									<div
										className={cn(
											"grid transition-all duration-200 ease-out",
											isEditing ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
										)}
									>
										<div className="overflow-hidden">
											<ScoreStepper score={homeScore} setScore={setHomeScore} />
										</div>
									</div>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<AvatarWithFallback src={awayPlayer.image} name={awayPlayer.name} size="sm" />
								<span className="text-sm flex-1 truncate min-w-0">
									{getFirstName(awayPlayer.name)}
								</span>
								<div className="flex items-center gap-2 shrink-0">
									<div
										className={cn(
											"flex h-7 w-7 items-center justify-center rounded-md border text-sm font-medium shrink-0 transition-all duration-200",
											isEditing && "bg-primary/10 scale-110 ring-2 ring-primary/20"
										)}
									>
										{isEditing ? awayScore : ""}
									</div>
									<div
										className={cn(
											"grid transition-all duration-200 ease-out",
											isEditing ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
										)}
									>
										<div className="overflow-hidden">
											<ScoreStepper score={awayScore} setScore={setAwayScore} />
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-col items-center justify-center gap-1 pl-2 border-l">
						{isEditing ? (
							<>
								<Button
									variant="ghost"
									size="sm"
									className="h-7 w-7 p-0 transition-transform active:scale-75"
									onClick={() =>
										createFromFixture({
											seasonSlug,
											homeScore,
											awayScore,
											fixtureId: nextFixture.id,
										})
									}
									disabled={isPending}
								>
									<Tick01Icon size={14} className="text-green-500" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="h-7 w-7 p-0 transition-transform active:scale-75"
									onClick={() => {
										setIsEditing(false);
										setHomeScore(0);
										setAwayScore(0);
									}}
									disabled={isPending}
								>
									<Cancel01Icon size={14} className="text-red-500" />
								</Button>
							</>
						) : (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0 transition-transform active:scale-75"
								onClick={() => setIsEditing(true)}
							>
								<PencilEdit01Icon className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">All fixtures played</div>
			)}
		</DashboardCard>
	);
}

export function DashboardCards({ seasonSlug }: DashboardCardsProps) {
	const trpc = useTRPC();
	const { data: season } = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));

	const isFixtureSeason = season?.scoreType === "3-1-0" && (season?.rounds ?? 0) > 0;

	return (
		<div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
			<OnFireCard seasonSlug={seasonSlug} />
			<StrugglingCard seasonSlug={seasonSlug} />
			{isFixtureSeason ? (
				<NextMatchCard seasonSlug={seasonSlug} />
			) : (
				<InfoCard seasonSlug={seasonSlug} />
			)}
			<LatestMatchCard seasonSlug={seasonSlug} />
		</div>
	);
}
