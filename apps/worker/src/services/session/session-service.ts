import type { DrizzleDB } from "../../db";
import * as sessionRepository from "../../repositories/session";
import * as matchRepository from "../../repositories/match-repository";
import { computeWinnerStaysLineup } from "./strategies/winner-stays";
import { computeManualLineup } from "./strategies/manual";
import { parseModeSettings, exhaustiveCheck } from "./strategies/types";
import type { WinnerStaysSettings } from "./strategies/types";

type FullSession = NonNullable<Awaited<ReturnType<typeof sessionRepository.getSessionById>>>;

function buildWinnerStaysSettings(session: FullSession): WinnerStaysSettings {
	const fromJson = parseModeSettings(session.modeSettings);
	if (fromJson?.mode === "winner-stays") return fromJson;
	return {
		mode: "winner-stays",
		maxConsecutiveGames: session.maxConsecutiveEnabled ? session.maxConsecutiveGames : null,
		winnersTakePriority: session.winnersTakePriority,
		autoRandomize: session.autoRandomize,
		randomizerType: session.randomizerType as "fisher-yates" | "diversity",
		autoCoinToss: session.autoCoinToss,
		alwaysSplitConstraints: session.alwaysSplitConstraints,
	};
}

export async function recordResult(
	db: DrizzleDB,
	{
		sessionId,
		sessionMatchId,
		homeScore,
		awayScore,
		seasonId,
		userId,
	}: {
		sessionId: string;
		sessionMatchId: string;
		homeScore: number;
		awayScore: number;
		seasonId: string;
		userId: string;
	}
) {
	const fullSession = await sessionRepository.getSessionById({ db, sessionId });
	if (!fullSession) throw new Error("Session not found");

	const sessionMatch = fullSession.matches.find((m) => m.id === sessionMatchId);
	if (!sessionMatch) throw new Error("Session match not found");

	const homeSeasonPlayerIds: string[] = sessionMatch.homePlayerIds;
	const awaySeasonPlayerIds: string[] = sessionMatch.awayPlayerIds;

	const result: "home" | "away" | "draw" =
		homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "draw";

	const createdMatch = await matchRepository.create({
		db,
		input: {
			seasonId,
			homeScore,
			awayScore,
			homeTeamPlayerIds: homeSeasonPlayerIds,
			awayTeamPlayerIds: awaySeasonPlayerIds,
			userId,
		},
	});

	const { match: updatedMatch, players: updatedPlayers } =
		await sessionRepository.recordMatchResult({
			db,
			sessionId,
			sessionMatchId,
			result,
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
	const effectiveMode = modeSettings?.mode ?? fullSession.rotationMode;

	const matchHistory = fullSession.matches.map((m) => ({
		homePlayerIds: m.homePlayerIds,
		awayPlayerIds: m.awayPlayerIds,
	}));

	const playerStates = updatedPlayers.map((p) => ({
		id: p.id,
		seasonPlayerId: p.seasonPlayerId,
		status: p.status,
		queuePosition: p.queuePosition,
		consecutiveGames: p.consecutiveGames,
	}));

	let proposedLineup: ReturnType<typeof computeWinnerStaysLineup> | null = null;
	let coinTossId: string | null = null;
	let autoResolvedCoinToss: { winnerNames: string[]; conflictType: string } | null = null;

	switch (effectiveMode) {
		case "winner-stays": {
			const settings = buildWinnerStaysSettings(fullSession);
			proposedLineup = computeWinnerStaysLineup({
				settings,
				players: playerStates,
				teamSize: fullSession.teamSize,
				lastMatchResult: result,
				lastMatchHome: homeSessionPlayerIds,
				lastMatchAway: awaySessionPlayerIds,
				matchHistory,
				resolvedCoinTossWinnerIds: null,
			});

			if (proposedLineup.coinTossNeeded) {
				const { conflictType, candidates } = proposedLineup.coinTossNeeded;

				if (settings.autoCoinToss) {
					let resolvedWinnerIds: string[];
					if (conflictType === "draw-tiebreak") {
						resolvedWinnerIds = Math.random() < 0.5 ? homeSessionPlayerIds : awaySessionPlayerIds;
					} else {
						const shuffled = [...candidates];
						for (let i = shuffled.length - 1; i > 0; i--) {
							const j = Math.floor(Math.random() * (i + 1));
							[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
						}
						resolvedWinnerIds = shuffled.slice(0, Math.ceil(candidates.length / 2));
					}

					const coinToss = await sessionRepository.createCoinToss({
						db,
						sessionId,
						sessionMatchId,
						conflictType,
						candidates,
					});
					await sessionRepository.resolveCoinToss({
						db,
						coinTossId: coinToss.id,
						resolvedWinnerIds,
					});

					proposedLineup = computeWinnerStaysLineup({
						settings,
						players: playerStates,
						teamSize: fullSession.teamSize,
						lastMatchResult: result,
						lastMatchHome: homeSessionPlayerIds,
						lastMatchAway: awaySessionPlayerIds,
						matchHistory,
						resolvedCoinTossWinnerIds: resolvedWinnerIds,
					});

					const winnerNames = resolvedWinnerIds
						.map((id) => fullSession.players.find((p) => p.id === id)?.displayName)
						.filter(Boolean) as string[];
					autoResolvedCoinToss = { winnerNames, conflictType };
				} else {
					const coinToss = await sessionRepository.createCoinToss({
						db,
						sessionId,
						sessionMatchId,
						conflictType,
						candidates,
					});
					coinTossId = coinToss.id;
				}
			}
			break;
		}
		case "manual": {
			proposedLineup = computeManualLineup();
			break;
		}
		default:
			exhaustiveCheck(effectiveMode as never);
	}

	await sessionRepository.updateProposedLineup({
		db,
		sessionId,
		proposedLineup: proposedLineup
			? {
					...proposedLineup,
					selectedHomePlayerIds: proposedLineup.homePlayerIds,
					selectedAwayPlayerIds: proposedLineup.awayPlayerIds,
				}
			: null,
	});

	return {
		match: updatedMatch,
		players: updatedPlayers,
		proposedLineup,
		coinTossId,
		autoResolvedCoinToss,
		streakData: {
			createdMatchId: createdMatch.id,
			homeSeasonPlayerIds,
			awaySeasonPlayerIds,
		},
	};
}

export async function resolveCoinToss(
	db: DrizzleDB,
	{ coinTossId, resolvedWinnerIds }: { coinTossId: string; resolvedWinnerIds: string[] }
) {
	const resolved = await sessionRepository.resolveCoinToss({ db, coinTossId, resolvedWinnerIds });
	if (!resolved) throw new Error("Coin toss not found");

	const fullSession = await sessionRepository.getSessionById({ db, sessionId: resolved.sessionId });
	if (!fullSession) throw new Error("Session not found");

	const triggeringMatch = resolved.sessionMatchId
		? fullSession.matches.find((m) => m.id === resolved.sessionMatchId)
		: null;

	if (!triggeringMatch?.result) return { resolved, proposedLineup: null };

	const modeSettings = parseModeSettings(fullSession.modeSettings);
	const effectiveMode = modeSettings?.mode ?? fullSession.rotationMode;

	if (effectiveMode !== "winner-stays") return { resolved, proposedLineup: null };

	const settings = buildWinnerStaysSettings(fullSession);
	const homeSeasonPlayerIds: string[] = triggeringMatch.homePlayerIds;
	const awaySeasonPlayerIds: string[] = triggeringMatch.awayPlayerIds;

	const homeSessionPlayerIds = fullSession.players
		.filter((p) => homeSeasonPlayerIds.includes(p.seasonPlayerId))
		.map((p) => p.id);
	const awaySessionPlayerIds = fullSession.players
		.filter((p) => awaySeasonPlayerIds.includes(p.seasonPlayerId))
		.map((p) => p.id);

	const proposedLineup = computeWinnerStaysLineup({
		settings,
		players: fullSession.players.map((p) => ({
			id: p.id,
			seasonPlayerId: p.seasonPlayerId,
			status: p.status,
			queuePosition: p.queuePosition,
			consecutiveGames: p.consecutiveGames,
		})),
		teamSize: fullSession.teamSize,
		lastMatchResult: triggeringMatch.result,
		lastMatchHome: homeSessionPlayerIds,
		lastMatchAway: awaySessionPlayerIds,
		matchHistory: fullSession.matches.map((m) => ({
			homePlayerIds: m.homePlayerIds,
			awayPlayerIds: m.awayPlayerIds,
		})),
		resolvedCoinTossWinnerIds: sessionRepository.parseStringArray(resolved.resolvedWinnerIds),
	});

	await sessionRepository.updateProposedLineup({
		db,
		sessionId: resolved.sessionId,
		proposedLineup: {
			...proposedLineup,
			selectedHomePlayerIds: proposedLineup.homePlayerIds,
			selectedAwayPlayerIds: proposedLineup.awayPlayerIds,
		},
	});

	return { resolved, proposedLineup };
}
