import type { SessionPlayer } from "../session-types";

export function SessionStandings({
	seasonSlug: _seasonSlug,
	leagueSlug: _leagueSlug,
	sessionPlayers,
}: {
	seasonSlug: string;
	leagueSlug: string;
	sessionPlayers: SessionPlayer[];
}) {
	return (
		<div className="border border-border">
			<div className="px-3 py-2 border-b border-border bg-muted/30">
				<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
					Standings
				</span>
			</div>
			<div className="p-2">
				{sessionPlayers.length === 0 ? (
					<p className="text-sm text-muted-foreground">No players in session</p>
				) : (
					<div className="flex flex-col gap-1">
						{sessionPlayers
							.slice()
							.sort((a, b) => b.score - a.score)
							.map((player, index) => (
								<div
									key={player.id}
									className="flex items-center gap-2 px-1 py-0.5"
								>
									<span className="text-xs text-muted-foreground w-4 text-right font-mono">
										{index + 1}
									</span>
									<span className="text-sm truncate">{player.displayName}</span>
									<span className="ml-auto text-sm font-semibold tabular-nums font-mono">
										{player.score}
									</span>
								</div>
							))}
					</div>
				)}
			</div>
		</div>
	);
}
