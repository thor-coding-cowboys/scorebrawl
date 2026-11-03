import type { DrizzleDB } from "../db";
import * as seasonPlayerRepository from "../repositories/season-player-repository";
import * as seasonRepository from "../repositories/season-repository";
import * as seasonTeamRepository from "../repositories/season-team-repository";

const MIN_MATCHES_FOR_WIN_RATE = 5;

type PlayerStanding = Awaited<ReturnType<typeof seasonPlayerRepository.getStanding>>[number];
type TeamStanding = Awaited<ReturnType<typeof seasonTeamRepository.getStanding>>[number];

const winRate = ({ matchCount, winCount }: { matchCount: number; winCount: number }) =>
	matchCount > 0 ? Math.round((winCount / matchCount) * 100) : 0;

const toPlayerRef = ({ id, name, image }: PlayerStanding) => ({ id, name, image });

const toPlayerStat = (p: PlayerStanding) => ({
	id: p.id,
	rank: p.rank,
	name: p.name,
	image: p.image,
	score: p.score,
	matchCount: p.matchCount,
	winCount: p.winCount,
	lossCount: p.lossCount,
	drawCount: p.drawCount,
	form: p.form,
	winRate: winRate(p),
});

const toTeamStat = (t: TeamStanding) => ({
	id: t.id,
	rank: t.rank,
	name: t.name,
	logo: t.logo,
	score: t.score,
	matchCount: t.matchCount,
	winCount: t.winCount,
	lossCount: t.lossCount,
	drawCount: t.drawCount,
	form: t.form,
	winRate: winRate(t),
	players: t.players,
});

export type SeasonSummary = Awaited<ReturnType<typeof getSeasonSummary>>;

export async function getSeasonSummary({
	db,
	season,
}: {
	db: DrizzleDB;
	season: { id: string; initialScore: number };
}) {
	const [players, teams, highlights, countInfo] = await Promise.all([
		seasonPlayerRepository.getStanding({ db, seasonId: season.id }),
		seasonTeamRepository.getStanding({ db, seasonId: season.id }),
		seasonRepository.getHighlights({ db, seasonId: season.id }),
		seasonRepository.getCountInfoById({ db, seasonId: season.id }),
	]);

	const playersById = new Map(players.map((p) => [p.id, p]));
	const resolvePlayers = (ids: string[]) =>
		ids.flatMap((id) => {
			const found = playersById.get(id);
			return found ? [toPlayerRef(found)] : [];
		});
	const resolvePlayer = (id: string) => resolvePlayers([id])[0] ?? null;

	const championStats =
		players[0] && countInfo.matchCount > 0
			? await seasonRepository.getChampionStats({ db, seasonPlayerId: players[0].id })
			: null;

	const topScore = players[0]?.score;
	const mostActive = players.reduce<PlayerStanding | null>(
		(best, p) => (p.matchCount > (best?.matchCount ?? 0) ? p : best),
		null
	);
	const mostWinsPlayer = players.reduce<PlayerStanding | null>(
		(best, p) => (p.winCount > (best?.winCount ?? 0) ? p : best),
		null
	);
	const bestRatePlayer = players
		.filter((p) => p.matchCount >= MIN_MATCHES_FOR_WIN_RATE)
		.map(toPlayerStat)
		.reduce<ReturnType<typeof toPlayerStat> | null>(
			(best, p) =>
				!best ||
				p.winRate > best.winRate ||
				(p.winRate === best.winRate && p.matchCount > best.matchCount)
					? p
					: best,
			null
		);
	const { longestWinStreak, biggestUpset, biggestGain, biggestWin } = highlights;
	const upsetHomeWon = biggestUpset ? biggestUpset.homeScore > biggestUpset.awayScore : false;
	const marginHomeWon = biggestWin ? biggestWin.homeScore > biggestWin.awayScore : false;
	const streakPlayer = longestWinStreak && resolvePlayer(longestWinStreak.seasonPlayerId);
	const gainPlayer = biggestGain && resolvePlayer(biggestGain.seasonPlayerId);

	return {
		matchCount: countInfo.matchCount,
		playerCount: countInfo.playerCount,
		champions:
			countInfo.matchCount > 0 ? players.filter((p) => p.score === topScore).map(toPlayerRef) : [],
		podium: players.slice(0, 3).map(toPlayerStat),
		championStats:
			championStats && players[0]
				? {
						peakScore: championStats.peakScore,
						longestStreak: championStats.longestStreak,
						pointsGained: players[0].score - season.initialScore,
						biggestWin: championStats.biggestWin
							? {
									winnerScore: championStats.biggestWin.winnerScore,
									loserScore: championStats.biggestWin.loserScore,
									opponents: resolvePlayers(championStats.biggestWin.opponentSeasonPlayerIds),
								}
							: null,
					}
				: null,
		teamPodium: teams
			.filter((t) => t.matchCount > 0)
			.slice(0, 3)
			.map(toTeamStat),
		highlights: {
			longestWinStreak:
				longestWinStreak && streakPlayer
					? { player: streakPlayer, length: longestWinStreak.length }
					: null,
			biggestUpset: biggestUpset
				? {
						winners: resolvePlayers(
							upsetHomeWon ? biggestUpset.homeSeasonPlayerIds : biggestUpset.awaySeasonPlayerIds
						),
						losers: resolvePlayers(
							upsetHomeWon ? biggestUpset.awaySeasonPlayerIds : biggestUpset.homeSeasonPlayerIds
						),
						winnerScore: Math.max(biggestUpset.homeScore, biggestUpset.awayScore),
						loserScore: Math.min(biggestUpset.homeScore, biggestUpset.awayScore),
						winnerOdds: biggestUpset.winnerOdds,
					}
				: null,
			biggestGain:
				biggestGain && gainPlayer ? { player: gainPlayer, gain: biggestGain.gain } : null,
			mostMatches:
				mostActive && mostActive.matchCount > 0
					? { player: toPlayerRef(mostActive), matchCount: mostActive.matchCount }
					: null,
			biggestWin: biggestWin
				? {
						winners: resolvePlayers(
							marginHomeWon ? biggestWin.homeSeasonPlayerIds : biggestWin.awaySeasonPlayerIds
						),
						losers: resolvePlayers(
							marginHomeWon ? biggestWin.awaySeasonPlayerIds : biggestWin.homeSeasonPlayerIds
						),
						winnerScore: Math.max(biggestWin.homeScore, biggestWin.awayScore),
						loserScore: Math.min(biggestWin.homeScore, biggestWin.awayScore),
					}
				: null,
			mostWins:
				mostWinsPlayer && mostWinsPlayer.winCount > 0
					? { player: toPlayerRef(mostWinsPlayer), winCount: mostWinsPlayer.winCount }
					: null,
			bestWinRate: bestRatePlayer
				? {
						player: {
							id: bestRatePlayer.id,
							name: bestRatePlayer.name,
							image: bestRatePlayer.image,
						},
						winRate: bestRatePlayer.winRate,
						matchCount: bestRatePlayer.matchCount,
					}
				: null,
		},
	};
}
