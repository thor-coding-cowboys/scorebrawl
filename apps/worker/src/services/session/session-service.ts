import type { DrizzleDB } from "../../db";
import * as matchRepository from "../../repositories/match-repository";
import * as sessionRepository from "../../repositories/session-repository";
import { computeWinnerStaysLineup } from "./strategies/winner-stays";
import { computeManualLineup } from "./strategies/manual";
import { parseModeSettings } from "./strategies/types";
import type { WinnerStaysLineup } from "./strategies/winner-stays";

export interface CreateSessionInput {
	seasonId: string;
	createdBy: string;
	teamSize: number;
	rotationMode: "winner-stays" | "manual";
	modeSettings:
		| {
				maxConsecutiveGames: number | null;
				winnersTakePriority: boolean;
				autoRandomize: boolean;
				randomizerType?: "fisher-yates" | "diversity";
				autoCoinToss: boolean;
				alwaysSplitConstraints: [string, string][];
		  }
		| undefined;
	playerSeasonIds: string[];
}

export interface RecordResultInput {
	sessionId: string;
	sessionMatchId: string;
	result: "home" | "away" | "draw";
	homeScore: number;
	awayScore: number;
	seasonId: string;
	leagueId: string;
}

export interface RecordResultOutput {
	match: { id: string };
	proposedLineup: WinnerStaysLineup | null;
	coinToss: { id: string } | null;
	streakData: {
		matchId: string;
		seasonId: string;
		leagueId: string;
		homePlayerIds: string[];
		awayPlayerIds: string[];
		result: "home" | "away" | "draw";
	};
}

export async function createSession(
	db: DrizzleDB,
	input: CreateSessionInput
): Promise<{
	id: string;
	seasonId: string;
	createdBy: string;
	rotationMode: "winner-stays" | "manual";
	teamSize: number;
	status: string;
	proposedLineup: string | null;
}> {
	return sessionRepository.createSession({
		db,
		seasonId: input.seasonId,
		createdBy: input.createdBy,
		rotationMode: input.rotationMode,
		teamSize: input.teamSize,
		modeSettings: input.modeSettings,
		seasonPlayerIds: input.playerSeasonIds,
	});
}

export async function recordResult(
	db: DrizzleDB,
	input: RecordResultInput
): Promise<RecordResultOutput> {
	const fullSession = await sessionRepository.getSessionById({
		db,
		sessionId: input.sessionId,
	});

	if (!fullSession) {
		throw new Error("Session not found");
	}

	const sessionMatch = fullSession.matches.find((m) => m.id === input.sessionMatchId);
	if (!sessionMatch) {
		throw new Error("Session match not found");
	}

	const homeSeasonPlayerIds: string[] = sessionMatch.homePlayerIds;
	const awaySeasonPlayerIds: string[] = sessionMatch.awayPlayerIds;

	const createdMatch = await matchRepository.create({
		db,
		input: {
			seasonId: input.seasonId,
			homeScore: input.homeScore,
			awayScore: input.awayScore,
			homeTeamPlayerIds: homeSeasonPlayerIds,
			awayTeamPlayerIds: awaySeasonPlayerIds,
			userId: input.leagueId,
		},
	});

	const { match: updatedMatch, players: updatedPlayers } =
		await sessionRepository.recordMatchResult({
			db,
			sessionId: input.sessionId,
			sessionMatchId: input.sessionMatchId,
			result: input.result,
			matchId: createdMatch.id,
			winnersTakePriority: fullSession.winnersTakePriority,
			maxConsecutiveEnabled: fullSession.maxConsecutiveEnabled,
			maxConsecutiveGames: fullSession.maxConsecutiveGames,
		});

	const homeSessionPlayerIds = updatedPlayers
		.filter((p) => homeSeasonPlayerIds.includes(p.seasonPlayerId))
		.map((p) => p.id);
	const awaySessionPlayerIds = updatedPlayers
		.filter((p) => awaySeasonPlayerIds.includes(p.seasonPlayerId))
		.map((p) => p.id);

	const modeSettings = parseModeSettings(fullSession.modeSettings);

	let proposedLineup: WinnerStaysLineup | null = null;
	let coinTossId: string | null = null;

	if (modeSettings?.mode === "winner-stays") {
		const winnerStaysInput = {
			settings: modeSettings,
			players: updatedPlayers.map((p) => ({
				id: p.id,
				seasonPlayerId: p.seasonPlayerId,
				status: p.status,
				queuePosition: p.queuePosition,
				consecutiveGames: p.consecutiveGames,
			})),
			teamSize: fullSession.teamSize,
			lastMatchResult: input.result,
			lastMatchHome: homeSessionPlayerIds,
			lastMatchAway: awaySessionPlayerIds,
			matchHistory: fullSession.matches.map((m) => ({
				homePlayerIds: m.homePlayerIds,
				awayPlayerIds: m.awayPlayerIds,
			})),
			resolvedCoinTossWinnerIds: null,
		};

		proposedLineup = computeWinnerStaysLineup(winnerStaysInput);

		if (proposedLineup.coinTossNeeded) {
			const { conflictType, candidates } = proposedLineup.coinTossNeeded;

			if (modeSettings.autoCoinToss) {
				let resolvedWinnerIds: string[];
				if (conflictType === "draw-tiebreak") {
					resolvedWinnerIds =
						Math.random() < 0.5 ? homeSessionPlayerIds : awaySessionPlayerIds;
				} else {
					const shuffled = [...candidates];
					for (let i = shuffled.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]!];
					}
					const winnerCount = Math.ceil(candidates.length / 2);
					resolvedWinnerIds = shuffled.slice(0, winnerCount);
				}

				const coinToss = await sessionRepository.createCoinToss({
					db,
					sessionId: input.sessionId,
					sessionMatchId: input.sessionMatchId,
					conflictType,
					candidates,
				});
				await sessionRepository.resolveCoinToss({
					db,
					coinTossId: coinToss.id,
					resolvedWinnerIds,
				});

				proposedLineup = computeWinnerStaysLineup({
					...winnerStaysInput,
					resolvedCoinTossWinnerIds: resolvedWinnerIds,
				});
			} else {
				const coinToss = await sessionRepository.createCoinToss({
					db,
					sessionId: input.sessionId,
					sessionMatchId: input.sessionMatchId,
					conflictType,
					candidates,
				});
				coinTossId = coinToss.id;
			}
		}
	} else if (modeSettings?.mode === "manual") {
		proposedLineup = computeManualLineup();
	}

	await sessionRepository.updateProposedLineup({
		db,
		sessionId: input.sessionId,
		proposedLineup: proposedLineup
			? {
					...proposedLineup,
					selectedHomePlayerIds: proposedLineup.homePlayerIds,
					selectedAwayPlayerIds: proposedLineup.awayPlayerIds,
				}
			: null,
	});

	return {
		match: { id: updatedMatch.id },
		proposedLineup,
		coinToss: coinTossId ? { id: coinTossId } : null,
		streakData: {
			matchId: createdMatch.id,
			seasonId: input.seasonId,
			leagueId: input.leagueId,
			homePlayerIds: homeSeasonPlayerIds,
			awayPlayerIds: awaySeasonPlayerIds,
			result: input.result,
		},
	};
}

export async function startNextMatch(
	db: DrizzleDB,
	sessionId: string,
	homeSeasonPlayerIds: string[],
	awaySeasonPlayerIds: string[]
) {
	return sessionRepository.startNextMatch({
		db,
		sessionId,
		homeSeasonPlayerIds,
		awaySeasonPlayerIds,
	});
}

export async function resolveCoinToss(
	db: DrizzleDB,
	input: { sessionId: string; coinTossId: string; winnerIds: string[] }
) {
	const resolved = await sessionRepository.resolveCoinToss({
		db,
		coinTossId: input.coinTossId,
		resolvedWinnerIds: input.winnerIds,
	});

	if (!resolved) {
		throw new Error("Coin toss not found");
	}

	const fullSession = await sessionRepository.getSessionById({
		db,
		sessionId: input.sessionId,
	});

	if (!fullSession) {
		throw new Error("Session not found");
	}

	const resolvedWinnerIds = resolved.resolvedWinnerIds
		? sessionRepository.parseStringArray(resolved.resolvedWinnerIds)
		: [];

	const triggeringMatch = resolved.sessionMatchId
		? fullSession.matches.find((m) => m.id === resolved.sessionMatchId)
		: null;

	let proposedLineup: WinnerStaysLineup | null = null;
	if (triggeringMatch?.result) {
		const homeSeasonPlayerIds: string[] = triggeringMatch.homePlayerIds;
		const awaySeasonPlayerIds: string[] = triggeringMatch.awayPlayerIds;

		const modeSettings = parseModeSettings(fullSession.modeSettings);

		if (modeSettings?.mode === "winner-stays") {
			proposedLineup = computeWinnerStaysLineup({
				settings: modeSettings,
				players: fullSession.players.map((p) => ({
					id: p.id,
					seasonPlayerId: p.seasonPlayerId,
					status: p.status,
					queuePosition: p.queuePosition,
					consecutiveGames: p.consecutiveGames,
				})),
				teamSize: fullSession.teamSize,
				lastMatchResult: triggeringMatch.result,
				lastMatchHome: fullSession.players
					.filter((p) => homeSeasonPlayerIds.includes(p.seasonPlayerId))
					.map((p) => p.id),
				lastMatchAway: fullSession.players
					.filter((p) => awaySeasonPlayerIds.includes(p.seasonPlayerId))
					.map((p) => p.id),
				resolvedCoinTossWinnerIds: resolvedWinnerIds,
				matchHistory: fullSession.matches.map((m) => ({
					homePlayerIds: m.homePlayerIds,
					awayPlayerIds: m.awayPlayerIds,
				})),
			});
		}
	}

	return { resolved, proposedLineup };
}

export async function addPlayer(
	db: DrizzleDB,
	sessionId: string,
	seasonPlayerId: string
) {
	return sessionRepository.addPlayerToSession({
		db,
		sessionId,
		seasonPlayerId,
	});
}

export async function removePlayer(
	db: DrizzleDB,
	sessionId: string,
	seasonPlayerId: string
) {
	return sessionRepository.removePlayerFromSession({
		db,
		sessionId,
		sessionPlayerId: seasonPlayerId,
	});
}

export async function cancelMatch(db: DrizzleDB, sessionId: string) {
	return sessionRepository.cancelCurrentMatch({
		db,
		sessionId,
	});
}

export async function deleteLastMatch(
	db: DrizzleDB,
	sessionId: string
): Promise<{
	deletedMatch: { id: string; matchId: string | null };
	players: unknown[];
	restoredProposedLineup: unknown;
}> {
	return sessionRepository.deleteLastMatch({
		db,
		sessionId,
	});
}

export async function endSession(db: DrizzleDB, sessionId: string) {
	return sessionRepository.endSession({
		db,
		sessionId,
	});
}

export async function updateMatchScore(
	db: DrizzleDB,
	input: {
		sessionId: string;
		sessionMatchId: string;
		homeScore: number;
		awayScore: number;
	}
) {
	return sessionRepository.updateMatchScore({
		db,
		sessionId: input.sessionId,
		sessionMatchId: input.sessionMatchId,
		homeScore: input.homeScore,
		awayScore: input.awayScore,
	});
}

export async function updateTeamSelection(
	db: DrizzleDB,
	input: {
		sessionId: string;
		sessionMatchId: string;
		selectedHomePlayerIds: string[];
		selectedAwayPlayerIds: string[];
	}
) {
	return sessionRepository.updateTeamSelection({
		db,
		sessionId: input.sessionId,
		sessionMatchId: input.sessionMatchId,
		selectedHomePlayerIds: input.selectedHomePlayerIds,
		selectedAwayPlayerIds: input.selectedAwayPlayerIds,
	});
}

export async function updateProposedLineup(
	db: DrizzleDB,
	input: {
		sessionId: string;
		proposedLineup: {
			homePlayerIds: string[];
			awayPlayerIds: string[];
			rotatedOut: string[];
			coinTossNeeded: { conflictType: string; candidates: string[] } | null;
			selectedHomePlayerIds?: string[];
			selectedAwayPlayerIds?: string[];
		};
	}
) {
	return sessionRepository.updateProposedLineup({
		db,
		sessionId: input.sessionId,
		proposedLineup: input.proposedLineup,
	});
}
