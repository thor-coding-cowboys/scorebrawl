import { fisherYatesShuffle, diversityShuffleWithHistory } from "../../../lib/shuffle";
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
	lastResult: "home" | "away" | "draw" | null,
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
	const { autoRandomize, alwaysSplitConstraints, randomizerType } = settings;

	const playingIds = new Set([...lastMatchHome, ...lastMatchAway]);

	const allEligible = players.filter((p) => p.status !== "out");
	const waiting = allEligible.filter((p) => p.status === "waiting" && !playingIds.has(p.id));

	const winnerLoser = getWinnerLoserIds(
		lastMatchResult,
		lastMatchHome,
		lastMatchAway,
		players,
		resolvedCoinTossWinnerIds ?? undefined
	);

	if (!winnerLoser) {
		return {
			homePlayerIds: [],
			awayPlayerIds: [],
			rotatedOut: [],
			coinTossNeeded: {
				conflictType: "draw-tiebreak",
				candidates: [...lastMatchHome, ...lastMatchAway],
			},
		};
	}

	const { winnerIds, loserIds } = winnerLoser;
	const winnerSet = new Set(winnerIds);
	const loserSet = new Set(loserIds);

	const slotsNeeded = teamSize * 2;

	if (waiting.length === 0) {
		if (autoRandomize) {
			const allPlaying =
				randomizerType === "diversity" && matchHistory
					? diversityShuffleWithHistory([...lastMatchHome, ...lastMatchAway], matchHistory)
					: fisherYatesShuffle([...lastMatchHome, ...lastMatchAway]);
			const newHome = allPlaying.slice(0, teamSize);
			const newAway = allPlaying.slice(teamSize, teamSize * 2);
			const constrained = enforceAlwaysSplit(newHome, newAway, alwaysSplitConstraints, players);
			return {
				homePlayerIds: constrained.homeIds,
				awayPlayerIds: constrained.awayIds,
				rotatedOut: [],
				coinTossNeeded: null,
			};
		}
		const constrained = enforceAlwaysSplit(
			[...lastMatchHome],
			[...lastMatchAway],
			alwaysSplitConstraints,
			players
		);
		return {
			homePlayerIds: constrained.homeIds,
			awayPlayerIds: constrained.awayIds,
			rotatedOut: [],
			coinTossNeeded: null,
		};
	}

	const sorted = [...allEligible].sort((a, b) => a.queuePosition - b.queuePosition);
	const selected = sorted.slice(0, slotsNeeded).map((p) => p.id);
	const selectedSet = new Set(selected);
	const rotatedOut = [...playingIds].filter((id) => !selectedSet.has(id));

	let newHome: string[];
	let newAway: string[];

	if (autoRandomize) {
		const shuffled =
			randomizerType === "diversity" && matchHistory
				? diversityShuffleWithHistory(selected, matchHistory)
				: fisherYatesShuffle(selected);
		newHome = shuffled.slice(0, teamSize);
		newAway = shuffled.slice(teamSize, teamSize * 2);
	} else {
		const winnersOnHome = lastMatchHome.some((id) => winnerSet.has(id));
		const winnersSelected = selected.filter((id) => winnerSet.has(id));
		const waitersSelected = selected.filter((id) => !winnerSet.has(id) && !playingIds.has(id));
		const losersSelected = selected.filter((id) => loserSet.has(id));

		if (winnersOnHome) {
			newHome = [...winnersSelected];
			newAway = [...waitersSelected, ...losersSelected].slice(0, teamSize);
			while (newAway.length < teamSize) {
				const extra = waitersSelected.find((id) => !newAway.includes(id));
				if (extra) newAway.push(extra);
				else break;
			}
			while (newHome.length < teamSize) {
				const extra = [...waitersSelected, ...losersSelected].find(
					(id) => !newHome.includes(id) && !newAway.includes(id)
				);
				if (extra) newHome.push(extra);
				else break;
			}
		} else {
			newAway = [...winnersSelected];
			newHome = [...waitersSelected, ...losersSelected].slice(0, teamSize);
			while (newHome.length < teamSize) {
				const extra = waitersSelected.find((id) => !newHome.includes(id));
				if (extra) newHome.push(extra);
				else break;
			}
			while (newAway.length < teamSize) {
				const extra = [...waitersSelected, ...losersSelected].find(
					(id) => !newHome.includes(id) && !newAway.includes(id)
				);
				if (extra) newAway.push(extra);
				else break;
			}
		}
	}

	const constrained = enforceAlwaysSplit(newHome, newAway, alwaysSplitConstraints, players);

	return {
		homePlayerIds: constrained.homeIds,
		awayPlayerIds: constrained.awayIds,
		rotatedOut,
		coinTossNeeded: null,
	};
}
