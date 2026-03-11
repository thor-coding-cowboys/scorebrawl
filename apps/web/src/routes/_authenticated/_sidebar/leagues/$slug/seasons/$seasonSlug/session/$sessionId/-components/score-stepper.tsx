import { Button } from "@/components/ui/button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Remove01Icon, ReloadIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import type { SessionPlayer } from "./session-types";

export function ScoreStepper({
	label,
	score,
	onIncrement,
	onDecrement,
}: {
	label: string;
	score: number;
	onIncrement: () => void;
	onDecrement: () => void;
}) {
	return (
		<div className="flex flex-col items-center gap-1 p-4">
			<div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-mono">
				{label}
			</div>
			<div className="flex items-center gap-3">
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					onClick={onDecrement}
					disabled={score <= 0}
				>
					<HugeiconsIcon icon={Remove01Icon} className="size-4" />
				</Button>
				<span className="text-5xl font-bold tabular-nums tracking-tighter w-16 text-center font-mono">
					{score}
				</span>
				<Button type="button" variant="outline" size="icon-sm" onClick={onIncrement}>
					<HugeiconsIcon icon={Add01Icon} className="size-4" />
				</Button>
			</div>
		</div>
	);
}

export function TeamRosterCard({
	label,
	players,
	emptyHint,
	isShuffling,
	expectedPlayerCount = 0,
}: {
	label: string;
	players: SessionPlayer[];
	emptyHint?: string;
	isShuffling?: boolean;
	expectedPlayerCount?: number;
}) {
	return (
		<div className="border border-border">
			<div className="px-3 py-2 border-b border-border bg-muted/30">
				<div className="flex items-center justify-between">
					<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
						{label}
					</span>
					<span className="text-xs font-mono text-muted-foreground">
						{isShuffling ? "-" : `${players.length}p`}
					</span>
				</div>
			</div>
			<div className="min-h-24 p-2">
				{isShuffling ? (
					<div className="flex flex-col gap-1 relative">
						{Array.from({ length: expectedPlayerCount }).map((_, i) => (
							<div key={i} className="flex items-center gap-2 px-1 py-0.5">
								<Skeleton className="size-8 rounded-full shrink-0" />
								<div className="min-w-0 flex-1 space-y-1">
									<Skeleton className="h-3 w-20" />
									<Skeleton className="h-2 w-8" />
								</div>
							</div>
						))}
						<div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 backdrop-blur-[1px]">
							<HugeiconsIcon icon={ReloadIcon} className="size-4 animate-spin" />
							<span className="text-xs font-medium">Shuffling...</span>
						</div>
					</div>
				) : players.length === 0 ? (
					<div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
						{emptyHint ?? "No players"}
					</div>
				) : (
					<div className="flex flex-col gap-1">
						{players.map((p) => (
							<div key={p.id} className="flex items-center gap-2 px-1 py-0.5">
								<AvatarWithFallback src={p.playerImage} name={p.displayName} size="sm" />
								<div className="min-w-0 flex-1">
									<p className="text-xs font-medium truncate">{p.displayName}</p>
									<p className="text-[0.65rem] text-muted-foreground font-mono">{p.score}</p>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export function QueueList({
	session,
	onRemovePlayer,
	isRemoving,
}: {
	session: { players: SessionPlayer[] };
	onRemovePlayer?: (sessionPlayerId: string) => void;
	isRemoving?: boolean;
}) {
	const playing = session.players.filter((p) => p.status === "playing");
	const waiting = session.players
		.filter((p) => p.status === "waiting")
		.sort((a, b) => a.queuePosition - b.queuePosition);
	const out = session.players.filter((p) => p.status === "out");

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
							onRemove={onRemovePlayer ? () => onRemovePlayer(p.id) : undefined}
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
							rank={i + 1}
							onRemove={onRemovePlayer ? () => onRemovePlayer(p.id) : undefined}
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
						<PlayerQueueRow key={p.id} player={p} />
					))}
				</>
			)}
		</div>
	);
}

export function PlayerQueueRow({
	player,
	rank,
	onRemove,
	isRemoving,
}: {
	player: SessionPlayer;
	rank?: number;
	onRemove?: () => void;
	isRemoving?: boolean;
}) {
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
						{Array.from({ length: Math.min(player.consecutiveGames, 8) }, (_, i) => (
							<span key={i} className="size-1.5 rounded-full bg-amber-500" />
						))}
						{player.consecutiveGames > 8 && (
							<span className="text-[0.6rem] text-amber-600 font-medium">
								+{player.consecutiveGames - 8}
							</span>
						)}
					</span>
				)}
				<span className="text-xs text-muted-foreground font-mono">
					{player.gamesPlayedThisSession}g
				</span>
				<span className="text-sm font-semibold tabular-nums font-mono">{player.score}</span>
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
