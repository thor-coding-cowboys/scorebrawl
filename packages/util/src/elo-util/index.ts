import * as EloLib from "@ihs7/ts-elo";

export type ScoreType = "elo" | "3-1-0" | "elo-individual-vs-team";

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
			strategy:
				scoreType === "elo"
					? EloLib.CalculationStrategy.TEAM_VS_TEAM
					: EloLib.CalculationStrategy.INDIVIDUAL_VS_TEAM,
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

interface EloCalculationInput {
	kFactor: number;
	strategy: EloLib.CalculationStrategy;
	homeScore: number;
	awayScore: number;
	homePlayers: EloPlayer[];
	awayPlayers: EloPlayer[];
}

const calculateElo = (input: EloCalculationInput): EloMatchResult => {
	const { kFactor, strategy, homeScore, awayScore, homePlayers, awayPlayers } = input;

	const eloMatch = new EloLib.TeamMatch({
		kFactor,
		calculationStrategy: strategy,
	});

	const eloHomeTeam = eloMatch.addTeam("home", homeScore);
	for (const p of homePlayers) {
		eloHomeTeam.addPlayer(new EloLib.Player(p.id, p.score));
	}

	const eloAwayTeam = eloMatch.addTeam("away", awayScore);
	for (const p of awayPlayers) {
		eloAwayTeam.addPlayer(new EloLib.Player(p.id, p.score));
	}

	const eloMatchResult = eloMatch.calculate();

	return {
		homeTeam: {
			winningOdds: eloHomeTeam.expectedScoreAgainst(eloAwayTeam),
			players: eloHomeTeam.players.map((p: { identifier: string }) => ({
				id: p.identifier,
				scoreAfter: eloMatchResult.results.find(
					(r: { identifier: string; rating: number }) => r.identifier === p.identifier
				)?.rating as number,
			})),
		},
		awayTeam: {
			winningOdds: eloAwayTeam.expectedScoreAgainst(eloHomeTeam),
			players: eloAwayTeam.players.map((p: { identifier: string }) => ({
				id: p.identifier,
				scoreAfter: eloMatchResult.results.find(
					(r: { identifier: string; rating: number }) => r.identifier === p.identifier
				)?.rating as number,
			})),
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
