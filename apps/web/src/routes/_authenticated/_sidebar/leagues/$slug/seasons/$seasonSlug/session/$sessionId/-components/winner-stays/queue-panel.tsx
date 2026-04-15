import { Button } from "@/components/ui/button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { HugeiconsIcon } from "@hugeicons/react";
import { ReloadIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { SessionPlayer, SessionMatch } from "../session-types";

export function QueuePanel({
	session,
	onRemovePlayer,
	isRemoving,
	onRejoinPlayer,
	isRejoining,
}: {
	session: { players: SessionPlayer[]; matches: SessionMatch[] };
	onRemovePlayer?: (sessionPlayerId: string) => void;
	isRemoving?: boolean;
	onRejoinPlayer?: (seasonPlayerId: string) => void;
	isRejoining?: boolean;
}) {
	const playing = session.players.filter((p) => p.status === "playing");
	const waiting = session.players
		.filter((p) => p.status === "waiting")
		.sort((a, b) => a.queuePosition - b.queuePosition);
	const out = session.players.filter((p) => p.status === "out");

	const hasActiveMatch = session.matches.some((m) => m.result === null);
	const canRemovePlaying = !hasActiveMatch ? onRemovePlayer : undefined;
	const canRemoveWaiting = onRemovePlayer;

	if (session.players.length === 0) {
		return (
			<div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
				No players
			</div>
		);
	}

	return (
		<div className="divide-y divide-border">
			{playing.length > 0 && (
				<>
					<div className="px-4 py-1.5 bg-muted/20">
						<span className="text-[0.65rem] font-mono font-medium uppercase tracking-wider text-muted-foreground">
							Playing
						</span>
					</div>
					{playing.map((p) => (
						<PlayerQueueRow
							key={p.id}
							player={p}
							matches={session.matches}
						onRemove={canRemovePlaying ? () => canRemovePlaying(p.id) : undefined}
						isRemoving={isRemoving}
					/>
				))}
			</>
		)}
		{waiting.length > 0 && (
				<>
					<div className="px-4 py-1.5 bg-muted/20">
						<span className="text-[0.65rem] font-mono font-medium uppercase tracking-wider text-muted-foreground">
							Queue
						</span>
					</div>
					{waiting.map((p, i) => (
						<PlayerQueueRow
							key={p.id}
							player={p}
							matches={session.matches}
							rank={i + 1}
							onRemove={canRemoveWaiting ? () => canRemoveWaiting(p.id) : undefined}
							isRemoving={isRemoving}
						/>
					))}
				</>
			)}
			{out.length > 0 && (
				<>
					<div className="px-4 py-1.5 bg-muted/20">
						<span className="text-[0.65rem] font-mono font-medium uppercase tracking-wider text-muted-foreground">
							Out
						</span>
					</div>
					{out.map((p) => (
						<PlayerQueueRow
							key={p.id}
							player={p}
							matches={session.matches}
							onRejoin={onRejoinPlayer ? () => onRejoinPlayer(p.seasonPlayerId) : undefined}
							isRejoining={isRejoining}
						/>
					))}
				</>
			)}
		</div>
	);
}

function getPlayerResultForMatch(
	player: SessionPlayer,
	match: SessionMatch
): "win" | "loss" | "draw" | null {
	if (!match.result) return null;

	const isHome = match.homePlayerIds.includes(player.seasonPlayerId);
	const isAway = match.awayPlayerIds.includes(player.seasonPlayerId);

	if (!isHome && !isAway) return null;

	if (match.result === "draw") return "draw";

	const isWinner = (isHome && match.result === "home") || (isAway && match.result === "away");
	return isWinner ? "win" : "loss";
}

export function PlayerQueueRow({
	player,
	matches,
	rank,
	onRemove,
	isRemoving,
	onRejoin,
	isRejoining,
}: {
	player: SessionPlayer;
	matches: SessionMatch[];
	rank?: number;
	onRemove?: () => void;
	isRemoving?: boolean;
	onRejoin?: () => void;
	isRejoining?: boolean;
}) {
	const playerMatches = matches
		.filter(
			(m) =>
				m.result &&
				(m.homePlayerIds.includes(player.seasonPlayerId) ||
					m.awayPlayerIds.includes(player.seasonPlayerId))
		)
		.sort((a, b) => b.matchNumber - a.matchNumber);

	const recentResults = playerMatches
		.slice(0, Math.min(player.consecutiveGames, 8))
		.reverse()
		.map((m) => getPlayerResultForMatch(player, m))
		.filter((r): r is "win" | "loss" | "draw" => r !== null);

	return (
		<div className="flex items-center gap-3 px-4 py-2">
			{rank !== undefined ? (
				<span className="text-xs text-muted-foreground w-4 text-right shrink-0 font-mono">
					{rank}
				</span>
			) : (
				<span className="w-4 shrink-0" />
			)}
			<AvatarWithFallback src={player.playerImage} name={player.displayName} size="sm" />
			<div className="flex flex-1 items-center gap-2 min-w-0">
				<span className="text-sm font-medium truncate">{player.displayName}</span>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				{player.consecutiveGames > 0 && (
					<span
						className="flex items-center gap-0.5"
						title={`${player.consecutiveGames} consecutive games played`}
					>
						{recentResults.map((result, i) => {
							const dotColor =
								result === "win"
									? "bg-green-500"
									: result === "loss"
										? "bg-red-500"
										: "bg-yellow-500";
							return <span key={i} className={cn("size-1.5 rounded-full", dotColor)} />;
						})}
						{player.consecutiveGames > 8 && (
							<span className="text-[0.6rem] text-muted-foreground font-medium">
								+{player.consecutiveGames - 8}
							</span>
						)}
					</span>
				)}
				<span className="text-xs text-muted-foreground font-mono">
					{player.gamesPlayedThisSession}g
				</span>
				<span className="text-sm font-semibold tabular-nums font-mono">{player.score}</span>
				{onRejoin && (
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onRejoin}
						disabled={isRejoining}
						className="h-6 w-6 text-muted-foreground hover:text-primary"
						title="Rejoin player to session"
					>
						<HugeiconsIcon icon={ReloadIcon} className="size-3.5" />
					</Button>
				)}
				{onRemove && (
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onRemove}
						disabled={isRemoving}
						className="h-6 w-6 text-muted-foreground hover:text-destructive"
						title="Remove player from session"
					>
						<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
					</Button>
				)}
			</div>
		</div>
	);
}
