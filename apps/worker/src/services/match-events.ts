import type { MatchDisplayPlayer } from "@coding-cowboys/scorebrawl-core/presentation";
import type { DrizzleDB } from "../db";
import type { scoreType } from "../db/schema/league-schema";
import * as matchRepository from "../repositories/match-repository";
import * as seasonPlayerRepository from "../repositories/season-player-repository";

export type SeasonScoreType = (typeof scoreType)[number];

export type Standing = Awaited<ReturnType<typeof seasonPlayerRepository.getStanding>>;

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
	standings: Standing;
}

export async function buildMatchInsertData(
	db: DrizzleDB,
	opts: {
		match: MatchInsertData["match"];
		scoreType: SeasonScoreType;
		standings: Standing;
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
		standings: opts.standings,
	};
}
