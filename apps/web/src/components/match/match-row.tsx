import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";

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
}

interface MatchRowProps {
	match: {
		id: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	seasonSlug: string;
}

function getSideLabel(players: MatchPlayer[]): string {
	if (players.length === 0) return "Unknown";
	const teamNames = players.map((p) => p.teamName).filter(Boolean);
	const uniqueTeams = [...new Set(teamNames)];
	if (uniqueTeams.length === 1 && teamNames.length === players.length) {
		return uniqueTeams[0] ?? "Unknown";
	}
	return players.map((p) => p.name).join(", ");
}

function formatDate(date: Date) {
	const now = new Date();
	const matchDate = new Date(date);

	const isToday =
		now.getFullYear() === matchDate.getFullYear() &&
		now.getMonth() === matchDate.getMonth() &&
		now.getDate() === matchDate.getDate();

	if (isToday) {
		const diffMs = now.getTime() - matchDate.getTime();
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		if (diffMinutes < 60) {
			return diffMinutes <= 1 ? "1m ago" : `${diffMinutes}m ago`;
		}
		const diffHours = Math.floor(diffMinutes / 60);
		return `${diffHours}h ago`;
	}
	return matchDate.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function MatchRow({ match, seasonSlug }: MatchRowProps) {
	const { data: matchDetails } = useQuery<{ players: MatchPlayer[] } | null>({
		queryKey: ["match", "details", match.id],
		queryFn: async () => {
			return await trpcClient.match.getById.query({ seasonSlug, matchId: match.id });
		},
		enabled: !!match.id,
	});

	const homePlayers = matchDetails?.players?.filter((p) => p.homeTeam) ?? [];
	const awayPlayers = matchDetails?.players?.filter((p) => !p.homeTeam) ?? [];

	return (
		<div className="flex items-center justify-between gap-4 p-4">
			<div className="flex flex-col gap-2 min-w-0 flex-1">
				<div className="flex items-center gap-2 min-w-0">
					<div className="flex gap-1 shrink-0">
						{homePlayers.map((player) => (
							<AvatarWithFallback key={player.id} src={player.image} name={player.name} size="sm" />
						))}
					</div>
					<span className="text-xs text-muted-foreground truncate">
						{getSideLabel(homePlayers)}
					</span>
				</div>
				<div className="flex items-center gap-2 min-w-0">
					<div className="flex gap-1 shrink-0">
						{awayPlayers.map((player) => (
							<AvatarWithFallback key={player.id} src={player.image} name={player.name} size="sm" />
						))}
					</div>
					<span className="text-xs text-muted-foreground truncate">
						{getSideLabel(awayPlayers)}
					</span>
				</div>
			</div>
			<div className="flex items-center gap-4 flex-shrink-0">
				<div className="text-center font-bold text-sm">
					{match.homeScore} - {match.awayScore}
				</div>
				<div className="text-xs text-muted-foreground text-right min-w-[60px]">
					{formatDate(match.createdAt)}
				</div>
			</div>
		</div>
	);
}
