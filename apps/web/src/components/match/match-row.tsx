import { MatchScoreDisplay, type MatchDisplayPlayer } from "./match-score-display";

interface MatchPlayer {
	id: string;
	seasonPlayerId: string;
	result: "W" | "D" | "L";
	scoreBefore: number;
	scoreAfter: number;
	name: string;
	image: string | null;
}

interface MatchTeam {
	name: string | null;
	logo: string | null;
	players: MatchPlayer[];
}

interface MatchRowProps {
	match: {
		id: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
		homeTeam: MatchTeam;
		awayTeam: MatchTeam;
	};
	seasonSlug: string;
	seasonId: string;
}

export function MatchRow({ match }: MatchRowProps) {
	const homePlayers: MatchDisplayPlayer[] = match.homeTeam.players.map((p) => ({
		id: p.id,
		name: p.name,
		image: p.image,
		teamName: match.homeTeam.name,
		teamLogo: match.homeTeam.logo,
		homeTeam: true,
	}));

	const awayPlayers: MatchDisplayPlayer[] = match.awayTeam.players.map((p) => ({
		id: p.id,
		name: p.name,
		image: p.image,
		teamName: match.awayTeam.name,
		teamLogo: match.awayTeam.logo,
		homeTeam: false,
	}));

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
