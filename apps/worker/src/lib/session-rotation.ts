export type RotationMode = "winner-stays" | "sequential" | "manual";

export interface SessionPlayerState {
	id: string;
	seasonPlayerId: string;
	status: "waiting" | "playing" | "out";
	queuePosition: number;
	gamesPlayedThisSession: number;
	consecutiveGames: number;
}

export type MatchResult = "home" | "away" | "draw";

export interface RotationInput {
	mode: RotationMode;
	teamSize: number;
	maxConsecutiveGames: number | null;
	maxConsecutiveEnabled?: boolean;
	winnersTakePriority?: boolean;
	autoRandomize: boolean;
	alwaysSplitConstraints: [string, string][];
	players: SessionPlayerState[];
	lastResult: MatchResult;
	homePlayerIds: string[];
	awayPlayerIds: string[];
	resolvedCoinTossWinnerIds?: string[];
	randomizerType?: "fisher-yates" | "diversity";
	matchHistory?: Array<{ homePlayerIds: string[]; awayPlayerIds: string[] }>;
}

export interface CoinTossNeeded {
	conflictType: "loser-rotation" | "max-consecutive-exceeded" | "draw-tiebreak";
	candidates: string[];
}

export interface ProposedLineup {
	homePlayerIds: string[];
	awayPlayerIds: string[];
	rotatedOut: string[];
	coinTossNeeded: CoinTossNeeded | null;
}

function playerById(players: SessionPlayerState[], id: string): SessionPlayerState | undefined {
	return players.find((p) => p.id === id);
}

export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i]!, result[j]!] = [result[j]!, result[i]!];
	}
	return result;
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

	return diversityShuffle(playerIds, pairWeights, (a, b) => {
		const key = [a, b].sort().join("|");
		return pairWeights.get(key) || 0;
	});
}

export function diversityShuffle<T>(
	items: T[],
	pairWeights: Map<string, number>,
	_getWeight: (a: T, b: T) => number
): T[] {
	const result: T[] = [];
	const remaining = [...items];

	while (remaining.length > 0) {
		const scored = remaining.map((item) => {
			let totalWeight = 0;
			for (const placed of result) {
				const key = [item, placed].sort().join("|");
				totalWeight += pairWeights.get(key) || 0;
			}
			return { item, score: totalWeight };
		});

		const totalScore = scored.reduce((sum, s) => sum + s.score + 1, 0);
		let random = Math.random() * totalScore;
		let selected = scored[0];

		for (const s of scored) {
			random -= s.score + 1;
			if (random < 0) {
				selected = s;
				break;
			}
		}

		result.push(selected.item);
		remaining.splice(remaining.indexOf(selected.item), 1);
	}

	return result;
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

function getWinnerLoserIds(
	lastResult: MatchResult,
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

export function computeNextLineup(input: RotationInput): ProposedLineup {
	const {
		mode,
		teamSize,
		autoRandomize,
		alwaysSplitConstraints,
		players,
		lastResult,
		homePlayerIds,
		awayPlayerIds,
		resolvedCoinTossWinnerIds,
	} = input;

	if (mode === "manual") {
		return { homePlayerIds: [], awayPlayerIds: [], rotatedOut: [], coinTossNeeded: null };
	}

	const playingIds = new Set([...homePlayerIds, ...awayPlayerIds]);

	const allEligible = players.filter((p) => p.status !== "out");
	const waiting = allEligible.filter((p) => p.status === "waiting" && !playingIds.has(p.id));
	const playing = allEligible.filter((p) => playingIds.has(p.id));

	if (mode === "sequential") {
		const sorted = [...allEligible].sort((a, b) => {
			if (a.consecutiveGames !== b.consecutiveGames) return a.consecutiveGames - b.consecutiveGames;
			return a.queuePosition - b.queuePosition;
		});

		const newHome = sorted.slice(0, teamSize).map((p) => p.id);
		const newAway = sorted.slice(teamSize, teamSize * 2).map((p) => p.id);
		const rotatedOut = playing.map((p) => p.id);

		const constrained = enforceAlwaysSplit(newHome, newAway, alwaysSplitConstraints, players);
		return {
			homePlayerIds: constrained.homeIds,
			awayPlayerIds: constrained.awayIds,
			rotatedOut,
			coinTossNeeded: null,
		};
	}

	const winnerLoser = getWinnerLoserIds(
		lastResult,
		homePlayerIds,
		awayPlayerIds,
		players,
		resolvedCoinTossWinnerIds
	);

	if (!winnerLoser) {
		return {
			homePlayerIds: [],
			awayPlayerIds: [],
			rotatedOut: [],
			coinTossNeeded: {
				conflictType: "draw-tiebreak",
				candidates: [...homePlayerIds, ...awayPlayerIds],
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
				input.randomizerType === "diversity" && input.matchHistory
					? diversityShuffleWithHistory([...homePlayerIds, ...awayPlayerIds], input.matchHistory)
					: fisherYatesShuffle([...homePlayerIds, ...awayPlayerIds]);
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
			[...homePlayerIds],
			[...awayPlayerIds],
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

	// Winner-stays: select by queuePosition ASC only (not by consecutiveGames)
	const sorted = [...allEligible].sort((a, b) => a.queuePosition - b.queuePosition);
	const selected = sorted.slice(0, slotsNeeded).map((p) => p.id);
	const selectedSet = new Set(selected);
	const rotatedOut = [...playingIds].filter((id) => !selectedSet.has(id));

	let newHome: string[];
	let newAway: string[];

	if (autoRandomize) {
		const shuffled =
			input.randomizerType === "diversity" && input.matchHistory
				? diversityShuffleWithHistory(selected, input.matchHistory)
				: fisherYatesShuffle(selected);
		newHome = shuffled.slice(0, teamSize);
		newAway = shuffled.slice(teamSize, teamSize * 2);
	} else {
		const winnersOnHome = homePlayerIds.some((id) => winnerSet.has(id));
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
