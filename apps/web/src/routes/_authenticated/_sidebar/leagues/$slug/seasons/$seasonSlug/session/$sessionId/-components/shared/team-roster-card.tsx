import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { ReloadIcon } from "@hugeicons/core-free-icons";
import type { SessionPlayer } from "../session-types";

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