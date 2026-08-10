import {
	calculateTeamMatch,
	calculateExpectedScore,
	CalculationStrategy,
	type TeamWithScore,
} from "@ihs7/ts-elo";

export type ScoreType = "elo" | "3-1-0" | "elo-individual-vs-team" | "1-v-n-elo";

export interface EloPlayer {
	id: string;
	score: number;
}

export interface EloMatchInput {
	scoreType: ScoreType;
	kFactor: number;
	homeScore: number;
	awayScore: number;
	homePlayers: EloPlayer[];
	awayPlayers: EloPlayer[];
}

export interface EloMatchResult {
	homeTeam: {
		winningOdds: number;
		players: { id: string; scoreAfter: number }[];
	};
	awayTeam: {
		winningOdds: number;
		players: { id: string; scoreAfter: number }[];
	};
}

export const calculateEloMatch = (input: EloMatchInput): EloMatchResult => {
	const { scoreType, kFactor, homeScore, awayScore, homePlayers, awayPlayers } = input;

	if (scoreType === "elo" || scoreType === "elo-individual-vs-team") {
		return calculateElo({
			kFactor,
			scoreType,
			homeScore,
			awayScore,
			homePlayers,
			awayPlayers,
		});
	}

	if (scoreType === "3-1-0") {
		return calculate310({ homeScore, awayScore, homePlayers, awayPlayers });
	}

	throw new Error(`Invalid score type: ${scoreType}`);
};

const toTeamWithScore = (players: EloPlayer[], score: number): TeamWithScore => ({
	players: players.map((p) => ({ id: p.id, rating: p.score })),
	score,
});

const calculateAvgRating = (players: EloPlayer[]): number =>
	players.reduce((sum, p) => sum + p.score, 0) / players.length;

export interface CalculateEloInput {
	kFactor: number;
	scoreType: "elo" | "elo-individual-vs-team";
	homeScore: number;
	awayScore: number;
	homePlayers: EloPlayer[];
	awayPlayers: EloPlayer[];
}

export const calculateElo = (input: CalculateEloInput): EloMatchResult => {
	const { kFactor, scoreType, homeScore, awayScore, homePlayers, awayPlayers } = input;

	const strategy =
		scoreType === "elo" ? CalculationStrategy.AVERAGE_TEAMS : CalculationStrategy.WEIGHTED_TEAMS;

	const homeTeam = toTeamWithScore(homePlayers, homeScore);
	const awayTeam = toTeamWithScore(awayPlayers, awayScore);

	const homeTeamAvgRating = calculateAvgRating(homePlayers);
	const awayTeamAvgRating = calculateAvgRating(awayPlayers);

	const results = calculateTeamMatch(homeTeam, awayTeam, { kFactor, strategy });

	return {
		homeTeam: {
			winningOdds: calculateExpectedScore(homeTeamAvgRating, awayTeamAvgRating),
			players: results
				.filter((r) => homePlayers.some((p) => p.id === r.id))
				.map((r) => ({ id: r.id, scoreAfter: r.newRating })),
		},
		awayTeam: {
			winningOdds: calculateExpectedScore(awayTeamAvgRating, homeTeamAvgRating),
			players: results
				.filter((r) => awayPlayers.some((p) => p.id === r.id))
				.map((r) => ({ id: r.id, scoreAfter: r.newRating })),
		},
	};
};

interface Calc310Input {
	homeScore: number;
	awayScore: number;
	homePlayers: EloPlayer[];
	awayPlayers: EloPlayer[];
}

const calculate310 = (input: Calc310Input): EloMatchResult => {
	const { homeScore, awayScore, homePlayers, awayPlayers } = input;

	return {
		homeTeam: {
			winningOdds: 0.5,
			players: homePlayers.map((p) => ({
				id: p.id,
				scoreAfter: p.score + (homeScore > awayScore ? 3 : homeScore === awayScore ? 1 : 0),
			})),
		},
		awayTeam: {
			winningOdds: 0.5,
			players: awayPlayers.map((p) => ({
				id: p.id,
				scoreAfter: p.score + (awayScore > homeScore ? 3 : awayScore === homeScore ? 1 : 0),
			})),
		},
	};
};

export const calculate1vN = ({
	kFactor,
	winner,
	losers,
}: {
	kFactor: number;
	winner: EloPlayer;
	losers: EloPlayer[];
}): {
	winner: { id: string; scoreAfter: number };
	losers: { id: string; scoreAfter: number }[];
} => {
	const scaledK = kFactor / losers.length;
	let winnerScoreAfter = winner.score;

	const loserResults = losers.map((loser) => {
		const expectedWinner = calculateExpectedScore(winner.score, loser.score);
		const delta = scaledK * (1 - expectedWinner);
		winnerScoreAfter += delta;
		return { id: loser.id, scoreAfter: loser.score - delta };
	});

	return {
		winner: { id: winner.id, scoreAfter: winnerScoreAfter },
		losers: loserResults,
	};
};

export const determineMatchResult = (
	homeScore: number,
	awayScore: number
): { homeResult: "W" | "D" | "L"; awayResult: "W" | "D" | "L" } => {
	if (homeScore > awayScore) {
		return { homeResult: "W", awayResult: "L" };
	}
	if (homeScore < awayScore) {
		return { homeResult: "L", awayResult: "W" };
	}
	return { homeResult: "D", awayResult: "D" };
};
