import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserMultipleIcon, ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useState } from "react";

const getAssetUrl = (key: string | null | undefined): string | null => {
	if (!key) return null;
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return key;
	}
	return `/api/user-assets/${key}`;
};

function TeamLogo({
	logo,
	name,
	size = "lg",
}: {
	logo: string | null;
	name: string;
	size?: "md" | "lg";
}) {
	const [hasError, setHasError] = useState(false);
	const logoUrl = getAssetUrl(logo);
	const sizeClass = size === "lg" ? "h-16 w-16" : "h-12 w-12";
	const iconSize = size === "lg" ? "size-8" : "size-6";

	if (!logoUrl || hasError) {
		return (
			<div className={cn("flex items-center justify-center rounded-lg bg-blue-500/10", sizeClass)}>
				<HugeiconsIcon icon={UserMultipleIcon} className={cn(iconSize, "text-blue-500")} />
			</div>
		);
	}

	return (
		<div className={cn("rounded-lg overflow-hidden bg-muted", sizeClass)}>
			<img
				src={logoUrl}
				alt={name}
				className="h-full w-full object-cover"
				onError={() => setHasError(true)}
			/>
		</div>
	);
}

interface PerformerCardProps {
	title: string;
	name: string;
	image: string | null;
	pointChange: number;
	winRate: number;
	matchCount: number;
	winCount: number;
	lossCount: number;
	isTeam?: boolean;
	variant: "top" | "bottom";
}

function PerformerCard({
	title,
	name,
	image,
	pointChange,
	winRate,
	matchCount,
	winCount,
	lossCount,
	isTeam,
	variant,
}: PerformerCardProps) {
	const isPositive = pointChange >= 0;
	const glowColor =
		variant === "top"
			? "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.1),transparent_70%)]"
			: "bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.1),transparent_70%)]";

	return (
		<div className="relative overflow-hidden rounded-lg border bg-card p-4">
			<div className={`absolute inset-0 ${glowColor}`} />
			<div className="relative flex flex-col items-center text-center">
				<span
					className={cn(
						"text-[10px] font-semibold uppercase tracking-wider mb-3",
						variant === "top" ? "text-green-500" : "text-red-500"
					)}
				>
					{title}
				</span>

				{isTeam ? (
					<TeamLogo logo={image} name={name} size="lg" />
				) : (
					<AvatarWithFallback src={image} name={name} size="xl" />
				)}

				<p className="mt-2 text-sm font-semibold truncate max-w-full">{name}</p>

				<div
					className={cn(
						"flex items-center gap-1 mt-1 text-lg font-bold",
						isPositive ? "text-green-500" : "text-red-500"
					)}
				>
					<HugeiconsIcon icon={isPositive ? ArrowUp01Icon : ArrowDown01Icon} className="size-4" />
					<span>
						{isPositive ? "+" : ""}
						{pointChange}
					</span>
				</div>

				<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
					<span>{Math.round(winRate * 100)}% WR</span>
					<span className="text-border">|</span>
					<span>
						{winCount}W {lossCount}L
					</span>
					<span className="text-border">|</span>
					<span>{matchCount} played</span>
				</div>
			</div>
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
			{message}
		</div>
	);
}

interface WeeklyPerformersProps {
	seasonSlug: string;
}

export function WeeklyPerformers({ seasonSlug }: WeeklyPerformersProps) {
	const trpc = useTRPC();

	const { data: playerStats, isLoading: playersLoading } = useQuery(
		trpc.seasonPlayer.getWeeklyStats.queryOptions({ seasonSlug })
	);

	const { data: teamStats, isLoading: teamsLoading } = useQuery(
		trpc.seasonTeam.getWeeklyStats.queryOptions({ seasonSlug })
	);

	const isLoading = playersLoading || teamsLoading;

	// Performance score formula: combines point change with win rate
	// pointChange contributes directly, win rate is scaled by match count
	// Formula: pointChange + (winRate - 0.5) * matchCount * 10
	// - Win rate above 50% adds to score, below 50% subtracts
	// - More matches = stronger signal from win rate
	const getPerformanceScore = (pointChange: number, winCount: number, matchCount: number) => {
		if (matchCount === 0) return 0;
		const winRate = winCount / matchCount;
		return pointChange + (winRate - 0.5) * matchCount * 10;
	};

	// Sort players by performance score to find top/bottom
	const sortedPlayers = [...(playerStats || [])].sort((a, b) => {
		const scoreA = getPerformanceScore(a.pointChange, a.winCount, a.matchCount);
		const scoreB = getPerformanceScore(b.pointChange, b.winCount, b.matchCount);
		return scoreB - scoreA;
	});
	const topPlayer = sortedPlayers[0];
	const bottomPlayer = sortedPlayers.length > 1 ? sortedPlayers[sortedPlayers.length - 1] : null;

	// Sort teams by performance score to find top/bottom
	const sortedTeams = [...(teamStats || [])].sort((a, b) => {
		const scoreA = getPerformanceScore(a.pointChange, a.winCount, a.matchCount);
		const scoreB = getPerformanceScore(b.pointChange, b.winCount, b.matchCount);
		return scoreB - scoreA;
	});
	const topTeam = sortedTeams[0];
	const bottomTeam = sortedTeams.length > 1 ? sortedTeams[sortedTeams.length - 1] : null;

	const getWinRate = (wins: number, matches: number) => (matches > 0 ? wins / matches : 0);

	// Get the last 7 days excluding today
	const now = new Date();
	const endDate = new Date(now);
	endDate.setDate(now.getDate() - 1); // Yesterday
	const startDate = new Date(endDate);
	startDate.setDate(endDate.getDate() - 6); // 7 days before yesterday

	const formatDate = (date: Date) =>
		date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-semibold">Last 7 Days</CardTitle>
					<span className="text-xs text-muted-foreground">
						{formatDate(startDate)} - {formatDate(endDate)}
					</span>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{isLoading ? (
					<div className="grid grid-cols-2 gap-3">
						<Skeleton className="h-40 w-full" />
						<Skeleton className="h-40 w-full" />
					</div>
				) : (
					<>
						{/* Players Section */}
						<div className="space-y-2">
							<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
								Players
							</h4>
							{topPlayer ? (
								<div className="grid grid-cols-2 gap-3">
									<PerformerCard
										title="Top Performer"
										name={topPlayer.playerName}
										image={topPlayer.playerImage}
										pointChange={topPlayer.pointChange}
										winRate={getWinRate(topPlayer.winCount, topPlayer.matchCount)}
										matchCount={topPlayer.matchCount}
										winCount={topPlayer.winCount}
										lossCount={topPlayer.lossCount}
										variant="top"
									/>
									{bottomPlayer && bottomPlayer.seasonPlayerId !== topPlayer.seasonPlayerId ? (
										<PerformerCard
											title="Needs Improvement"
											name={bottomPlayer.playerName}
											image={bottomPlayer.playerImage}
											pointChange={bottomPlayer.pointChange}
											winRate={getWinRate(bottomPlayer.winCount, bottomPlayer.matchCount)}
											matchCount={bottomPlayer.matchCount}
											winCount={bottomPlayer.winCount}
											lossCount={bottomPlayer.lossCount}
											variant="bottom"
										/>
									) : (
										<div />
									)}
								</div>
							) : (
								<EmptyState message="No matches this week" />
							)}
						</div>

						{/* Teams Section */}
						{(teamStats?.length ?? 0) > 0 && (
							<div className="space-y-2">
								<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									Teams
								</h4>
								{topTeam ? (
									<div className="grid grid-cols-2 gap-3">
										<PerformerCard
											title="Top Team"
											name={topTeam.teamName}
											image={topTeam.teamLogo}
											pointChange={topTeam.pointChange}
											winRate={getWinRate(topTeam.winCount, topTeam.matchCount)}
											matchCount={topTeam.matchCount}
											winCount={topTeam.winCount}
											lossCount={topTeam.lossCount}
											isTeam
											variant="top"
										/>
										{bottomTeam && bottomTeam.seasonTeamId !== topTeam.seasonTeamId ? (
											<PerformerCard
												title="Struggling Team"
												name={bottomTeam.teamName}
												image={bottomTeam.teamLogo}
												pointChange={bottomTeam.pointChange}
												winRate={getWinRate(bottomTeam.winCount, bottomTeam.matchCount)}
												matchCount={bottomTeam.matchCount}
												winCount={bottomTeam.winCount}
												lossCount={bottomTeam.lossCount}
												isTeam
												variant="bottom"
											/>
										) : (
											<div />
										)}
									</div>
								) : (
									<EmptyState message="No team matches this week" />
								)}
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
