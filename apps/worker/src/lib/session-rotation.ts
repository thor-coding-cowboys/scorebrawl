export type RotationMode = "winner-stays" | "round-robin" | "manual";

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
	autoRandomize: boolean;
	alwaysSplitConstraints: [string, string][]; // seasonPlayer ID pairs
	players: SessionPlayerState[];
	lastResult: MatchResult;
	homePlayerIds: string[];
	awayPlayerIds: string[];
	/** When set, forces the coin-toss outcome: these sessionPlayer IDs stay in; the rest of the candidates rotate out. */
	resolvedCoinTossWinnerIds?: string[];
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

function fisherYatesShuffle<T>(arr: T[]): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i]!, result[j]!] = [result[j]!, result[i]!];
	}
	return result;
}

function enforceAlwaysSplit(
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

export function computeNextLineup(input: RotationInput): ProposedLineup {
	const {
		mode,
		teamSize,
		maxConsecutiveGames,
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

	if (mode === "round-robin") {
		const playing = players.filter((p) => p.status === "playing");
		const waiting = players
			.filter((p) => p.status === "waiting")
			.sort((a, b) => a.queuePosition - b.queuePosition);

		const maxQueue = Math.max(...players.map((p) => p.queuePosition), 0);
		const rotatedOut = playing.map((p) => p.id);

		const allQueued = [
			...waiting,
			...playing
				.slice()
				.sort((a, b) => a.queuePosition - b.queuePosition)
				.map((p, i) => ({ ...p, queuePosition: maxQueue + i + 1 })),
		];

		const newHome = allQueued.slice(0, teamSize).map((p) => p.id);
		const newAway = allQueued.slice(teamSize, teamSize * 2).map((p) => p.id);

		const constrained = enforceAlwaysSplit(newHome, newAway, alwaysSplitConstraints, players);
		return {
			homePlayerIds: constrained.homeIds,
			awayPlayerIds: constrained.awayIds,
			rotatedOut,
			coinTossNeeded: null,
		};
	}

	// winner-stays

	const playingIds = new Set([...homePlayerIds, ...awayPlayerIds]);
	const waitingQueue = players
		.filter((p) => p.status === "waiting" && !playingIds.has(p.id))
		.sort((a, b) => a.queuePosition - b.queuePosition);

	const totalPlaying = homePlayerIds.length + awayPlayerIds.length;
	const slotsToFill = Math.min(waitingQueue.length, totalPlaying);

	// ── Rule 1: No waiters → nobody out ──
	if (slotsToFill === 0) {
		if (autoRandomize) {
			const allPlaying = fisherYatesShuffle([...homePlayerIds, ...awayPlayerIds]);
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

	// ── Determine winners / losers ──
	let winnerIds: string[];
	let loserIds: string[];

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
			winnerIds = awayPlayerIds;
			loserIds = homePlayerIds;
		} else if (awaySum > homeSum) {
			winnerIds = homePlayerIds;
			loserIds = awayPlayerIds;
		} else if (resolvedCoinTossWinnerIds && resolvedCoinTossWinnerIds.length > 0) {
			const homeSet = new Set(homePlayerIds);
			const winnersAreHome = resolvedCoinTossWinnerIds.some((id) => homeSet.has(id));
			winnerIds = winnersAreHome ? homePlayerIds : awayPlayerIds;
			loserIds = winnersAreHome ? awayPlayerIds : homePlayerIds;
		} else {
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
	} else {
		winnerIds = lastResult === "home" ? homePlayerIds : awayPlayerIds;
		loserIds = lastResult === "home" ? awayPlayerIds : homePlayerIds;
	}

	const winnersOnHome = homePlayerIds.includes(winnerIds[0] ?? "");

	// ── Special: waiters >= playing → all rotate out ──
	if (slotsToFill >= totalPlaying) {
		const incoming = autoRandomize
			? fisherYatesShuffle(waitingQueue.slice(0, teamSize * 2).map((p) => p.id))
			: waitingQueue.slice(0, teamSize * 2).map((p) => p.id);
		const newHome = incoming.slice(0, teamSize);
		const newAway = incoming.slice(teamSize, teamSize * 2);
		const allPlayingIds = [...homePlayerIds, ...awayPlayerIds];
		const constrained = enforceAlwaysSplit(newHome, newAway, alwaysSplitConstraints, players);
		return {
			homePlayerIds: constrained.homeIds,
			awayPlayerIds: constrained.awayIds,
			rotatedOut: allPlayingIds,
			coinTossNeeded: null,
		};
	}

	// ── Sort helpers ──
	const byConsecutiveDesc = (a: SessionPlayerState, b: SessionPlayerState) =>
		b.consecutiveGames - a.consecutiveGames;

	const loserStates = loserIds
		.map((id) => playerById(players, id))
		.filter((p): p is SessionPlayerState => p !== undefined)
		.sort(byConsecutiveDesc);

	const winnerStates = winnerIds
		.map((id) => playerById(players, id))
		.filter((p): p is SessionPlayerState => p !== undefined)
		.sort(byConsecutiveDesc);

	const allPlayingStates = [...loserStates, ...winnerStates];

	// ── Rule 3: maxConsecutiveGames forces rotation ──
	const forced =
		maxConsecutiveGames !== null
			? allPlayingStates
					.filter((p) => p.consecutiveGames >= maxConsecutiveGames)
					.sort(byConsecutiveDesc)
			: [];

	const forcedIds = new Set(forced.map((p) => p.id));
	type PlayerGroup = "forced" | "loser" | "winner";

	// ── Build rotation list with tie detection ──
	const rotateOut: string[] = [];
	let remaining = slotsToFill;

	const pickFromCandidates = (
		candidates: SessionPlayerState[],
		count: number,
		group: PlayerGroup
	): { picked: string[]; coinToss: CoinTossNeeded | null } => {
		if (count <= 0 || candidates.length === 0) return { picked: [], coinToss: null };
		if (candidates.length <= count) return { picked: candidates.map((p) => p.id), coinToss: null };

		const lastOut = candidates[count - 1]!;
		const firstIn = candidates[count]!;

		if (lastOut.consecutiveGames === firstIn.consecutiveGames) {
			const tiedConsecutive = lastOut.consecutiveGames;
			const tiedCandidates = candidates.filter((p) => p.consecutiveGames === tiedConsecutive);

			if (resolvedCoinTossWinnerIds && resolvedCoinTossWinnerIds.length > 0) {
				const staySet = new Set(resolvedCoinTossWinnerIds);
				const tiedOut = tiedCandidates.filter((p) => !staySet.has(p.id));
				const tiedStay = tiedCandidates.filter((p) => staySet.has(p.id));
				const nonTied = candidates.filter((p) => p.consecutiveGames !== tiedConsecutive);
				const reordered = [...nonTied, ...tiedOut, ...tiedStay];
				reordered.sort((a, b) => {
					const aGroup = a.consecutiveGames !== tiedConsecutive ? 0 : staySet.has(a.id) ? 2 : 1;
					const bGroup = b.consecutiveGames !== tiedConsecutive ? 0 : staySet.has(b.id) ? 2 : 1;
					if (aGroup !== bGroup) return aGroup - bGroup;
					return b.consecutiveGames - a.consecutiveGames;
				});
				return { picked: reordered.slice(0, count).map((p) => p.id), coinToss: null };
			}

			const definiteOut = candidates
				.slice(0, count)
				.filter((p) => p.consecutiveGames !== tiedConsecutive)
				.map((p) => p.id);
			return {
				picked: definiteOut,
				coinToss: {
					conflictType: group === "forced" ? "max-consecutive-exceeded" : "loser-rotation",
					candidates: tiedCandidates.map((p) => p.id),
				},
			};
		}

		return { picked: candidates.slice(0, count).map((p) => p.id), coinToss: null };
	};

	const loserIdSet = new Set(loserIds);

	const pickStep = (
		candidates: SessionPlayerState[],
		group: PlayerGroup
	): CoinTossNeeded | null => {
		const count = Math.min(candidates.length, remaining);
		const result = pickFromCandidates(candidates, count, group);
		if (result.coinToss) return result.coinToss;
		rotateOut.push(...result.picked);
		remaining -= result.picked.length;
		return null;
	};

	// Step 1: Forced players — tier by consecutiveGames (highest first),
	// within each tier losers before winners.
	const consecutiveTiers = [...new Set(forced.map((p) => p.consecutiveGames))].sort(
		(a, b) => b - a
	);
	for (const tier of consecutiveTiers) {
		if (remaining <= 0) break;
		const tierPlayers = forced.filter((p) => p.consecutiveGames === tier);
		const tierLosers = tierPlayers.filter((p) => loserIdSet.has(p.id));
		const tierWinners = tierPlayers.filter((p) => !loserIdSet.has(p.id));

		if (remaining > 0 && tierLosers.length > 0) {
			const coinToss = pickStep(tierLosers, "forced");
			if (coinToss) {
				return {
					homePlayerIds: [],
					awayPlayerIds: [],
					rotatedOut: rotateOut,
					coinTossNeeded: coinToss,
				};
			}
		}
		if (remaining > 0 && tierWinners.length > 0) {
			const coinToss = pickStep(tierWinners, "forced");
			if (coinToss) {
				return {
					homePlayerIds: [],
					awayPlayerIds: [],
					rotatedOut: rotateOut,
					coinTossNeeded: coinToss,
				};
			}
		}
	}

	// Step 2: Non-forced losers (Rule 4)
	if (remaining > 0) {
		const nonForcedLosers = loserStates.filter((p) => !forcedIds.has(p.id)).sort(byConsecutiveDesc);
		const coinToss2 = pickStep(nonForcedLosers, "loser");
		if (coinToss2) {
			return {
				homePlayerIds: [],
				awayPlayerIds: [],
				rotatedOut: rotateOut,
				coinTossNeeded: coinToss2,
			};
		}
	}

	// Step 3: Non-forced winners (Rule 4 overflow)
	if (remaining > 0) {
		const nonForcedWinners = winnerStates
			.filter((p) => !forcedIds.has(p.id))
			.sort(byConsecutiveDesc);
		const coinToss3 = pickStep(nonForcedWinners, "winner");
		if (coinToss3) {
			return {
				homePlayerIds: [],
				awayPlayerIds: [],
				rotatedOut: rotateOut,
				coinTossNeeded: coinToss3,
			};
		}
	}

	// ── Build teams ──
	const displacedSet = new Set(rotateOut);
	const survivingWinners = winnerStates.filter((p) => !displacedSet.has(p.id));
	const survivingLosers = loserStates.filter((p) => !displacedSet.has(p.id));

	let finalHome: string[];
	let finalAway: string[];

	if (autoRandomize) {
		const allPlaying = fisherYatesShuffle([
			...survivingWinners.map((p) => p.id),
			...survivingLosers.map((p) => p.id),
			...waitingQueue.slice(0, slotsToFill).map((p) => p.id),
		]);
		finalHome = allPlaying.slice(0, teamSize);
		finalAway = allPlaying.slice(teamSize, teamSize * 2);
	} else {
		const winnerTeam = [...survivingWinners.map((p) => p.id)];
		const opposingPool = [...waitingQueue.map((p) => p.id), ...survivingLosers.map((p) => p.id)];

		while (winnerTeam.length < teamSize && opposingPool.length > teamSize) {
			winnerTeam.push(opposingPool.shift()!);
		}

		finalHome = winnersOnHome ? winnerTeam : opposingPool;
		finalAway = winnersOnHome ? opposingPool : winnerTeam;
	}

	const constrained = enforceAlwaysSplit(finalHome, finalAway, alwaysSplitConstraints, players);

	return {
		homePlayerIds: constrained.homeIds,
		awayPlayerIds: constrained.awayIds,
		rotatedOut: rotateOut,
		coinTossNeeded: null,
	};
}
