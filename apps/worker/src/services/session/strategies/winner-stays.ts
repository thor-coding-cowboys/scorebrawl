import { diversityShuffle, fisherYatesShuffle } from "../../../lib/shuffle";
import type { WinnerStaysSettings } from "./types";

export interface SessionPlayerState {
	id: string;
	seasonPlayerId: string;
	status: "waiting" | "playing" | "out";
	queuePosition: number;
	consecutiveGames: number;
}

export interface MatchHistoryEntry {
	homePlayerIds: string[];
	awayPlayerIds: string[];
}

export interface CoinTossNeeded {
	conflictType: "loser-rotation" | "max-consecutive-exceeded" | "draw-tiebreak";
	candidates: string[];
}

export interface WinnerStaysLineup {
	homePlayerIds: string[];
	awayPlayerIds: string[];
	rotatedOut: string[];
	coinTossNeeded: CoinTossNeeded | null;
}

export interface WinnerStaysRotationInput {
	settings: WinnerStaysSettings;
	players: SessionPlayerState[];
	teamSize: number;
	lastMatchResult: "home" | "away" | "draw" | null;
	lastMatchHome: string[];
	lastMatchAway: string[];
	matchHistory: MatchHistoryEntry[];
	resolvedCoinTossWinnerIds: string[] | null;
}

function playerById(players: SessionPlayerState[], id: string): SessionPlayerState | undefined {
	return players.find((p) => p.id === id);
}

function getWinnerLoserIds(
	lastResult: "home" | "away" | "draw",
	homePlayerIds: string[],
	awayPlayerIds: string[],
	players: SessionPlayerState[],
	resolvedCoinTossWinnerIds?: string[]
): { winnerIds: string[]; loserIds: string[] } | null {
	if (lastResult === "draw") {
		const homeSum = homePlayerIds.reduce(
			(sum, id) => sum + (playerById(players, id)?.consecutiveGames ?? 0),
			0
		);
		const awaySum = awayPlayerIds.reduce(
			(sum, id) => sum + (playerById(players, id)?.consecutiveGames ?? 0),
			0
		);

		if (homeSum > awaySum) {
			return { winnerIds: awayPlayerIds, loserIds: homePlayerIds };
		} else if (awaySum > homeSum) {
			return { winnerIds: homePlayerIds, loserIds: awayPlayerIds };
		} else if (resolvedCoinTossWinnerIds && resolvedCoinTossWinnerIds.length > 0) {
			const homeSet = new Set(homePlayerIds);
			const winnersAreHome = resolvedCoinTossWinnerIds.some((id) => homeSet.has(id));
			return {
				winnerIds: winnersAreHome ? homePlayerIds : awayPlayerIds,
				loserIds: winnersAreHome ? awayPlayerIds : homePlayerIds,
			};
		} else {
			return null;
		}
	}
	return {
		winnerIds: lastResult === "home" ? homePlayerIds : awayPlayerIds,
		loserIds: lastResult === "home" ? awayPlayerIds : homePlayerIds,
	};
}

export function enforceAlwaysSplit(
	homeIds: string[],
	awayIds: string[],
	constraints: [string, string][],
	players: SessionPlayerState[]
): { homeIds: string[]; awayIds: string[] } {
	const home = new Set(homeIds);
	const away = new Set(awayIds);

	const constraintPairs = constraints
		.map(([spA, spB]) => {
			const pA = players.find((p) => p.seasonPlayerId === spA);
			const pB = players.find((p) => p.seasonPlayerId === spB);
			return pA && pB ? ([pA.id, pB.id] as [string, string]) : null;
		})
		.filter((pair): pair is [string, string] => pair !== null);

	const isConstrained = (idA: string, idB: string) =>
		constraintPairs.some(([x, y]) => (x === idA && y === idB) || (x === idB && y === idA));

	for (const [idA, idB] of constraintPairs) {
		const aInHome = home.has(idA);
		const bInHome = home.has(idB);
		if (!aInHome && !away.has(idA)) continue;
		if (!bInHome && !away.has(idB)) continue;

		if (aInHome !== bInHome) continue;

		const pA = players.find((p) => p.id === idA)!;
		const pB = players.find((p) => p.id === idB)!;
		const swapTarget = pA.queuePosition > pB.queuePosition ? pA : pB;
		const stayTarget = swapTarget === pA ? pB : pA;

		const sameTeam = aInHome ? home : away;
		const otherTeam = aInHome ? away : home;

		const otherTeamArr = [...otherTeam];
		const swapPartner = otherTeamArr.find((id) => !isConstrained(id, stayTarget.id));

		if (swapPartner) {
			sameTeam.delete(swapTarget.id);
			otherTeam.add(swapTarget.id);
			otherTeam.delete(swapPartner);
			sameTeam.add(swapPartner);
		}
	}

	return { homeIds: [...home], awayIds: [...away] };
}

function diversityShuffleWithHistory(
	playerIds: string[],
	matchHistory: Array<{ homePlayerIds: string[]; awayPlayerIds: string[] }>
): string[] {
	const pairWeights = new Map<string, number>();

	for (const match of matchHistory) {
		const allPlayers = [...match.homePlayerIds, ...match.awayPlayerIds];
		for (let i = 0; i < allPlayers.length; i++) {
			for (let j = i + 1; j < allPlayers.length; j++) {
				const key = [allPlayers[i]!, allPlayers[j]!].sort().join("|");
				pairWeights.set(key, (pairWeights.get(key) || 0) + 1);
			}
		}
	}

	return diversityShuffle(playerIds, pairWeights);
}

export function computeWinnerStaysLineup(input: WinnerStaysRotationInput): WinnerStaysLineup {
	const {
		settings,
		players,
		teamSize,
		lastMatchResult,
		lastMatchHome,
		lastMatchAway,
		matchHistory,
		resolvedCoinTossWinnerIds,
	} = input;

	const waitingPlayers = players.filter((p) => p.status === "waiting");
	const playingPlayers = players.filter((p) => p.status === "playing");

	if (waitingPlayers.length === 0 && playingPlayers.length === 0) {
		return {
			homePlayerIds: [],
			awayPlayerIds: [],
			rotatedOut: [],
			coinTossNeeded: null,
		};
	}

	if (lastMatchResult === null) {
		const playersToAssign = [...waitingPlayers];
		if (playersToAssign.length < teamSize * 2) {
			return {
				homePlayerIds: [],
				awayPlayerIds: [],
				rotatedOut: [],
				coinTossNeeded: null,
			};
		}

		let shuffled: string[];
		if (settings.autoRandomize) {
			if (settings.randomizerType === "diversity" && matchHistory.length > 0) {
				shuffled = diversityShuffleWithHistory(
					playersToAssign.map((p) => p.seasonPlayerId),
					matchHistory
				);
			} else {
				shuffled = fisherYatesShuffle(playersToAssign.map((p) => p.seasonPlayerId));
			}
		} else {
			shuffled = playersToAssign.map((p) => p.seasonPlayerId);
		}

		const homePlayerIds = shuffled.slice(0, teamSize);
		const awayPlayerIds = shuffled.slice(teamSize, teamSize * 2);

		const homeWithState = homePlayerIds.map((id) => players.find((p) => p.seasonPlayerId === id)!);
		const awayWithState = awayPlayerIds.map((id) => players.find((p) => p.seasonPlayerId === id)!);

		const constrained = enforceAlwaysSplit(
			homePlayerIds,
			awayPlayerIds,
			settings.alwaysSplitConstraints,
			[...homeWithState, ...awayWithState]
		);

		return {
			homePlayerIds: constrained.homeIds,
			awayPlayerIds: constrained.awayIds,
			rotatedOut: [],
			coinTossNeeded: null,
		};
	}

	const winnerLoser = getWinnerLoserIds(
		lastMatchResult,
		lastMatchHome,
		lastMatchAway,
		players,
		resolvedCoinTossWinnerIds ?? undefined
	);

	if (!winnerLoser) {
		const candidates = [...lastMatchHome, ...lastMatchAway];
		return {
			homePlayerIds: lastMatchHome,
			awayPlayerIds: lastMatchAway,
			rotatedOut: [],
			coinTossNeeded: {
				conflictType: "draw-tiebreak",
				candidates,
			},
		};
	}

	const { winnerIds, loserIds } = winnerLoser;
	const loserSessionPlayers = loserIds
		.map((id) => players.find((p) => p.seasonPlayerId === id))
		.filter((p): p is SessionPlayerState => p !== undefined);

	const losersAtMax =
		settings.maxConsecutiveGames !== null
			? loserSessionPlayers.filter((p) => p.consecutiveGames >= settings.maxConsecutiveGames!)
			: [];

	if (losersAtMax.length > 0) {
		const candidates = losersAtMax.map((p) => p.seasonPlayerId);
		return {
			homePlayerIds: lastMatchHome,
			awayPlayerIds: lastMatchAway,
			rotatedOut: [],
			coinTossNeeded: {
				conflictType: "max-consecutive-exceeded",
				candidates,
			},
		};
	}

	const overrides = loserSessionPlayers.filter(
		(p) =>
			settings.maxConsecutiveGames !== null && p.consecutiveGames >= settings.maxConsecutiveGames
	);
	const overrideIds = new Set(overrides.map((p) => p.seasonPlayerId));
	const nonOverrideLosers = loserIds.filter((id) => !overrideIds.has(id));

	const neededFromQueue = teamSize - (winnerIds.length - overrides.length);
	const fromQueue = waitingPlayers
		.filter((p) => !winnerIds.includes(p.seasonPlayerId))
		.sort((a, b) => a.queuePosition - b.queuePosition)
		.slice(0, neededFromQueue);

	const rotatedOut = nonOverrideLosers;
	const newTeam = [
		...winnerIds.filter((id) => !overrideIds.has(id)),
		...fromQueue.map((p) => p.seasonPlayerId),
	];

	if (newTeam.length < teamSize) {
		const additionalNeeded = teamSize - newTeam.length;
		const additionalFromLosers = nonOverrideLosers
			.filter((id) => !newTeam.includes(id))
			.slice(0, additionalNeeded);
		newTeam.push(...additionalFromLosers);
		rotatedOut.push(...additionalFromLosers);
	}

	if (newTeam.length < teamSize) {
		return {
			homePlayerIds: lastMatchHome,
			awayPlayerIds: lastMatchAway,
			rotatedOut: [],
			coinTossNeeded: {
				conflictType: "loser-rotation",
				candidates: [...newTeam, ...rotatedOut],
			},
		};
	}

	let homePlayerIds: string[];
	let awayPlayerIds: string[];

	if (settings.winnersTakePriority) {
		const shuffledWinners = settings.autoRandomize
			? settings.randomizerType === "diversity" && matchHistory.length > 0
				? diversityShuffleWithHistory(newTeam, matchHistory)
				: fisherYatesShuffle(newTeam)
			: newTeam;
		homePlayerIds = shuffledWinners.slice(0, teamSize);
		awayPlayerIds = shuffledWinners.slice(teamSize, teamSize * 2);
	} else {
		const queueIds = fromQueue.map((p) => p.seasonPlayerId);
		const combined = settings.autoRandomize
			? settings.randomizerType === "diversity" && matchHistory.length > 0
				? diversityShuffleWithHistory([...queueIds, ...newTeam], matchHistory)
				: fisherYatesShuffle([...queueIds, ...newTeam])
			: [...queueIds, ...newTeam];
		homePlayerIds = combined.slice(0, teamSize);
		awayPlayerIds = combined.slice(teamSize, teamSize * 2);
	}

	const homeWithState = homePlayerIds.map((id) => players.find((p) => p.seasonPlayerId === id)!);
	const awayWithState = awayPlayerIds.map((id) => players.find((p) => p.seasonPlayerId === id)!);
	const allTeamPlayers = [...homeWithState, ...awayWithState];

	const constrained = enforceAlwaysSplit(
		homePlayerIds,
		awayPlayerIds,
		settings.alwaysSplitConstraints,
		allTeamPlayers
	);

	return {
		homePlayerIds: constrained.homeIds,
		awayPlayerIds: constrained.awayIds,
		rotatedOut,
		coinTossNeeded: null,
	};
}
