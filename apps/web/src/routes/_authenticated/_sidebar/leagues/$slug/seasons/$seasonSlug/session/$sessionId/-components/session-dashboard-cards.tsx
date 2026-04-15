import { useMemo } from "react";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { DashboardCard } from "../../../../-components/season/dashboard-card";
import { useCarousel } from "@/hooks/use-carousel";
import { cn } from "@/lib/utils";
import { FireIcon, Crown02Icon, Award01Icon, BarChartIcon } from "@hugeicons/core-free-icons";
import { computeWinStreaks } from "./session-utils";
import type { GameSession, SessionMatch, SessionPlayer } from "./session-types";

export function SessionDashboardCards({ session }: { session: GameSession }) {
	const { scrollRef, activeIndex, onScroll, onTouchStart, onTouchEnd, containerStyle } =
		useCarousel(4, { autoAdvance: false });

	const completedMatches = session.matches.filter((m) => m.result !== null);
	const activePlayers = session.players.filter((p) => p.status !== "out");

	const winStreaks = useMemo(() => computeWinStreaks(session), [session]);
	const hotEntry =
		[...winStreaks.entries()].filter(([, streak]) => streak > 0).sort((a, b) => b[1] - a[1])[0] ??
		null;
	const hotPlayer = hotEntry
		? (session.players.find((p) => p.seasonPlayerId === hotEntry[0]) ?? null)
		: null;
	const hotStreak = hotEntry?.[1] ?? 0;

	const mvp =
		[...session.players]
			.filter((p) => p.gamesPlayedThisSession > 0)
			.sort((a, b) => b.score - a.score)[0] ?? null;

	const lastMatch =
		completedMatches.length > 0 ? completedMatches[completedMatches.length - 1] : null;

	const cards = [
		<HotStreakCard key="hot" player={hotPlayer} streak={hotStreak} />,
		<SessionMVPCard key="mvp" player={mvp} />,
		<LatestResultCard key="latest" match={lastMatch} session={session} />,
		<SessionInfoCard
			key="info"
			matchCount={completedMatches.length}
			playerCount={activePlayers.length}
			rotationMode={session.modeSettings?.mode ?? "manual"}
		/>,
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

function HotStreakCard({ player, streak }: { player: SessionPlayer | null; streak: number }) {
	return (
		<DashboardCard
			title="Hot Streak"
			icon={FireIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.1),transparent_60%)]"
			iconColor="text-red-600"
		>
			{player && streak > 0 ? (
				<div className="flex items-center gap-3 min-w-0">
					<AvatarWithFallback src={player.playerImage} name={player.displayName} size="md" />
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-sm font-medium truncate">{player.displayName}</span>
						<div className="flex items-center gap-1.5">
							<span className="flex items-center gap-0.5">
								{Array.from({ length: Math.min(streak, 5) }, (_, i) => (
									<span key={i} className="size-1.5 rounded-full bg-emerald-500" />
								))}
							</span>
							<span className="text-xs text-muted-foreground">
								{streak} win{streak !== 1 ? "s" : ""} in a row
							</span>
						</div>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No active streaks</div>
			)}
		</DashboardCard>
	);
}

function SessionMVPCard({ player }: { player: SessionPlayer | null }) {
	return (
		<DashboardCard
			title="Session MVP"
			icon={Crown02Icon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),transparent_60%)]"
			iconColor="text-amber-600"
		>
			{player ? (
				<div className="flex items-center gap-3 min-w-0">
					<AvatarWithFallback src={player.playerImage} name={player.displayName} size="md" />
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-sm font-medium truncate">{player.displayName}</span>
						<span className="text-xs text-muted-foreground">
							{player.score} pts · {player.gamesPlayedThisSession}g
						</span>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No matches yet</div>
			)}
		</DashboardCard>
	);
}

function LatestResultCard({
	match,
	session,
}: {
	match: SessionMatch | null;
	session: GameSession;
}) {
	if (!match) {
		return (
			<DashboardCard
				title="Latest Result"
				icon={Award01Icon}
				glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]"
				iconColor="text-blue-600"
			>
				<div className="text-sm text-muted-foreground">No matches yet</div>
			</DashboardCard>
		);
	}

	const homePlayers = match.homePlayerIds
		.map((sid) => session.players.find((p) => p.seasonPlayerId === sid))
		.filter((p): p is SessionPlayer => !!p);
	const awayPlayers = match.awayPlayerIds
		.map((sid) => session.players.find((p) => p.seasonPlayerId === sid))
		.filter((p): p is SessionPlayer => !!p);

	const homeLabel = homePlayers.map((p) => p.displayName.split(" ")[0]).join(" & ");
	const awayLabel = awayPlayers.map((p) => p.displayName.split(" ")[0]).join(" & ");
	const homeWon = match.result === "home";
	const awayWon = match.result === "away";

	return (
		<DashboardCard
			title="Latest Result"
			icon={Award01Icon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]"
			iconColor="text-blue-600"
		>
			<div className="space-y-1.5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 min-w-0">
						<div className="flex -space-x-1">
							{homePlayers.slice(0, 2).map((p) => (
								<AvatarWithFallback key={p.id} src={p.playerImage} name={p.displayName} size="sm" />
							))}
						</div>
						<span
							className={cn(
								"text-xs truncate",
								homeWon ? "font-semibold" : "text-muted-foreground"
							)}
						>
							{homeLabel}
						</span>
					</div>
					<span
						className={cn(
							"text-sm font-mono tabular-nums",
							homeWon ? "font-bold" : "text-muted-foreground"
						)}
					>
						{homeWon ? "W" : awayWon ? "L" : "D"}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 min-w-0">
						<div className="flex -space-x-1">
							{awayPlayers.slice(0, 2).map((p) => (
								<AvatarWithFallback key={p.id} src={p.playerImage} name={p.displayName} size="sm" />
							))}
						</div>
						<span
							className={cn(
								"text-xs truncate",
								awayWon ? "font-semibold" : "text-muted-foreground"
							)}
						>
							{awayLabel}
						</span>
					</div>
					<span
						className={cn(
							"text-sm font-mono tabular-nums",
							awayWon ? "font-bold" : "text-muted-foreground"
						)}
					>
						{awayWon ? "W" : homeWon ? "L" : "D"}
					</span>
				</div>
			</div>
		</DashboardCard>
	);
}

function SessionInfoCard({
	matchCount,
	playerCount,
	rotationMode,
}: {
	matchCount: number;
	playerCount: number;
	rotationMode: string;
}) {
	const modeLabel =
		rotationMode === "winner-stays"
			? "Winner stays"
			: rotationMode === "round-robin"
				? "Round robin"
				: "Manual";

	return (
		<DashboardCard
			title="Session Info"
			icon={BarChartIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]"
			iconColor="text-emerald-600"
		>
			<div className="grid grid-cols-3 gap-2 text-center">
				<div>
					<div className="text-lg font-bold">{matchCount}</div>
					<div className="text-xs text-muted-foreground">Matches</div>
				</div>
				<div>
					<div className="text-lg font-bold">{playerCount}</div>
					<div className="text-xs text-muted-foreground">Players</div>
				</div>
				<div>
					<div className="text-xs font-bold leading-6">{modeLabel}</div>
					<div className="text-xs text-muted-foreground">Mode</div>
				</div>
			</div>
		</DashboardCard>
	);
}
