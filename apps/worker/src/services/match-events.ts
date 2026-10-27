import type { MatchDisplayPlayer } from "@coding-cowboys/scorebrawl-core/presentation";
import type { DrizzleDB } from "../db";
import type { scoreType } from "../db/schema/league-schema";
import * as matchRepository from "../repositories/match-repository";

export type SeasonScoreType = (typeof scoreType)[number];

export interface MatchInsertData {
	match: {
		id: string;
		seasonId: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	scoreType: SeasonScoreType;
	players: MatchDisplayPlayer[];
}

export async function buildMatchInsertData(
	db: DrizzleDB,
	opts: {
		match: MatchInsertData["match"];
		scoreType: SeasonScoreType;
	}
): Promise<MatchInsertData> {
	const matchWithPlayers = await matchRepository.getMatchWithPlayers({
		db,
		matchId: opts.match.id,
	});
	return {
		match: opts.match,
		scoreType: opts.scoreType,
		players: matchWithPlayers?.players ?? [],
	};
}
