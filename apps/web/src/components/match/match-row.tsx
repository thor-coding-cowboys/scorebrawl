import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { MatchScoreDisplay, type MatchDisplayPlayer } from "./match-score-display";

interface MatchRowProps {
	match: {
		id: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	seasonSlug: string;
	seasonId: string;
}

export function MatchRow({ match, seasonSlug }: MatchRowProps) {
	const { data: matchDetails } = useQuery({
		queryKey: ["match", "details", match.id],
		queryFn: () => trpcClient.match.getById.query({ seasonSlug, matchId: match.id }),
		enabled: !!match.id,
	});

	const homePlayers = (matchDetails?.players?.filter((p: MatchDisplayPlayer) => p.homeTeam) ??
		[]) as MatchDisplayPlayer[];
	const awayPlayers = (matchDetails?.players?.filter((p: MatchDisplayPlayer) => !p.homeTeam) ??
		[]) as MatchDisplayPlayer[];

	return (
		<MatchScoreDisplay
			matchId={match.id}
			homeScore={match.homeScore}
			awayScore={match.awayScore}
			createdAt={match.createdAt}
			homePlayers={homePlayers}
			awayPlayers={awayPlayers}
		/>
	);
}
