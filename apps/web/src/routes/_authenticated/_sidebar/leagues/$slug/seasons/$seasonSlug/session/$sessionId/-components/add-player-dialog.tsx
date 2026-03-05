import { useQuery } from "@tanstack/react-query";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { trpcClient } from "@/lib/trpc";
import type { AnyTRPC } from "@/lib/trpc";
import type { GameSession } from "./session-types";

export function AddPlayerDialog({
	open,
	onOpenChange,
	session,
	seasonSlug,
	onAdd,
	isAdding,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	session: GameSession;
	seasonSlug: string;
	onAdd: (seasonPlayerId: string) => void;
	isAdding: boolean;
}) {
	const client = trpcClient as AnyTRPC;
	const existingSeasonPlayerIds = new Set(session.players.map((p) => p.seasonPlayerId));

	const { data: allPlayers } = useQuery({
		queryKey: ["seasonPlayer.getStanding", seasonSlug],
		queryFn: () =>
			client.seasonPlayer.getStanding.query({ seasonSlug }) as Promise<
				Array<{ id: string; name: string; score: number; image: string | null }>
			>,
		enabled: open,
	});

	const available = allPlayers?.filter((p) => !existingSeasonPlayerIds.has(p.id)) ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Add Player</DialogTitle>
					<DialogDescription>Select a player to add to this session.</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
					{available.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4 text-center">
							All season players are already in the session.
						</p>
					) : (
						available.map((player) => (
							<button
								key={player.id}
								type="button"
								onClick={() => onAdd(player.id)}
								disabled={isAdding}
								className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left w-full"
							>
								<AvatarWithFallback src={player.image} name={player.name} size="sm" />
								<span className="text-sm font-medium flex-1">{player.name}</span>
								<span className="text-sm tabular-nums text-muted-foreground font-mono">
									{player.score}
								</span>
							</button>
						))
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
