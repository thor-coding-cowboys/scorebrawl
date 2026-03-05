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
			// Coin toss resolved: check which team the winners belong to
			const homeSet = new Set(homePlayerIds);
			const winnersAreHome = resolvedCoinTossWinnerIds.some((id) => homeSet.has(id));
			winnerIds = winnersAreHome ? homePlayerIds : awayPlayerIds;
			loserIds = winnersAreHome ? awayPlayerIds : homePlayerIds;
		} else {
			const allPlayingIds = [...homePlayerIds, ...awayPlayerIds];
			return {
				homePlayerIds: [],
				awayPlayerIds: [],
				rotatedOut: [],
				coinTossNeeded: { conflictType: "draw-tiebreak", candidates: allPlayingIds },
			};
		}
	} else {
		winnerIds = lastResult === "home" ? homePlayerIds : awayPlayerIds;
		loserIds = lastResult === "home" ? awayPlayerIds : homePlayerIds;
	}

	const winnersOnHome = homePlayerIds.includes(winnerIds[0] ?? "");

	const playingIds = new Set([...homePlayerIds, ...awayPlayerIds]);
	const waitingQueue = players
		.filter((p) => p.status === "waiting" && !playingIds.has(p.id))
		.sort((a, b) => a.queuePosition - b.queuePosition);

	// Displacement-first: N incoming players displace exactly N current players.
	// Displacement priority: losers first (most consecutiveGames, then most gamesPlayed),
	// then winners (only relevant when maxConsecutiveGames forces them out).
	const N = waitingQueue.length;

	const byPriority = (a: SessionPlayerState, b: SessionPlayerState) => {
		if (b.consecutiveGames !== a.consecutiveGames) return b.consecutiveGames - a.consecutiveGames;
		return b.gamesPlayedThisSession - a.gamesPlayedThisSession;
	};

	const loserStates = loserIds
		.map((id) => playerById(players, id))
		.filter((p): p is SessionPlayerState => p !== undefined)
		.sort(byPriority);

	const winnerStates = winnerIds
		.map((id) => playerById(players, id))
		.filter((p): p is SessionPlayerState => p !== undefined)
		.sort(byPriority);

	// Apply maxConsecutiveGames: winners over the limit are forced into the displacement list.
	// players snapshot is always post-mutation (consecutiveGames already incremented).
	const forcedWinners =
		maxConsecutiveGames !== null
			? winnerStates.filter((p) => p.consecutiveGames >= maxConsecutiveGames)
			: [];

	// Displacement list: forced winners first (must leave when possible), then losers, then remaining winners
	const remainingWinners = winnerStates.filter((p) => !forcedWinners.includes(p));
	const displacementList = [...forcedWinners, ...loserStates, ...remainingWinners];

	// Check for a coin-toss tie at the cut point (position N-1 / N)
	const forcedWinnerIds = new Set(forcedWinners.map((p) => p.id));
	const playerGroup = (id: string) =>
		forcedWinnerIds.has(id) ? "forced" : loserIds.includes(id) ? "loser" : "winner";

	if (N > 0 && N < displacementList.length) {
		const lastOut = displacementList[N - 1];
		const firstIn = displacementList[N];
		if (
			lastOut &&
			firstIn &&
			lastOut.consecutiveGames === firstIn.consecutiveGames &&
			lastOut.gamesPlayedThisSession === firstIn.gamesPlayedThisSession &&
			// Only coin-toss within the same group (forced vs forced, losers vs losers, or winners vs winners)
			playerGroup(lastOut.id) === playerGroup(firstIn.id)
		) {
			const tiedStats = { c: lastOut.consecutiveGames, g: lastOut.gamesPlayedThisSession };
			const tiedGroup = playerGroup(lastOut.id);
			const tiedCandidates = displacementList.filter(
				(p) =>
					p.consecutiveGames === tiedStats.c &&
					p.gamesPlayedThisSession === tiedStats.g &&
					playerGroup(p.id) === tiedGroup
			);

			if (resolvedCoinTossWinnerIds && resolvedCoinTossWinnerIds.length > 0) {
				// Re-order displacementList: toss losers (not in resolvedWinners) come first within the tied group
				const tiedCandidateIds = new Set(tiedCandidates.map((p) => p.id));
				const reordered = [...displacementList.filter((p) => !tiedCandidateIds.has(p.id))];
				// Among tied candidates: those NOT in resolvedWinnerIds go out first
				const tiedLosers = tiedCandidates.filter((p) => !resolvedCoinTossWinnerIds.includes(p.id));
				const tiedWinners = tiedCandidates.filter((p) => resolvedCoinTossWinnerIds.includes(p.id));
				// Insert tiedLosers before tiedWinners at their original position in the list
				const insertPos = displacementList.findIndex((p) => tiedCandidateIds.has(p.id));
				reordered.splice(insertPos, 0, ...tiedLosers, ...tiedWinners);

				const resolvedDisplaced = new Set(reordered.slice(0, N).map((p) => p.id));
				const resolvedRotatedOut = [...resolvedDisplaced];
				const resolvedSurvivingLosers = loserStates.filter((p) => !resolvedDisplaced.has(p.id));
				const resolvedSurvivingWinners = winnerStates.filter((p) => !resolvedDisplaced.has(p.id));
				const resolvedWinnerTeam = [...resolvedSurvivingWinners.map((p) => p.id)];
				const resolvedOpposingPool = [
					...waitingQueue.map((p) => p.id),
					...resolvedSurvivingLosers.map((p) => p.id),
				];
				while (resolvedWinnerTeam.length < teamSize && resolvedOpposingPool.length > teamSize) {
					resolvedWinnerTeam.push(resolvedOpposingPool.pop()!);
				}
				const resolvedFinalHome = winnersOnHome ? resolvedWinnerTeam : resolvedOpposingPool;
				const resolvedFinalAway = winnersOnHome ? resolvedOpposingPool : resolvedWinnerTeam;
				const resolvedConstrained = enforceAlwaysSplit(
					resolvedFinalHome,
					resolvedFinalAway,
					alwaysSplitConstraints,
					players
				);
				return {
					homePlayerIds: resolvedConstrained.homeIds,
					awayPlayerIds: resolvedConstrained.awayIds,
					rotatedOut: resolvedRotatedOut,
					coinTossNeeded: null,
				};
			}

			const definiteOut = displacementList
				.slice(0, N)
				.filter(
					(p) => p.consecutiveGames !== tiedStats.c || p.gamesPlayedThisSession !== tiedStats.g
				)
				.map((p) => p.id);
			return {
				homePlayerIds: [],
				awayPlayerIds: [],
				rotatedOut: definiteOut,
				coinTossNeeded: {
					conflictType:
						playerGroup(lastOut.id) === "loser" ? "loser-rotation" : "max-consecutive-exceeded",
					candidates: tiedCandidates.map((p) => p.id),
				},
			};
		}
	}

	const displaced = new Set(displacementList.slice(0, N).map((p) => p.id));
	const rotatedOut = [...displaced];

	// Survivors
	const survivingLosers = loserStates.filter((p) => !displaced.has(p.id));
	const survivingWinners = winnerStates.filter((p) => !displaced.has(p.id));

	// Build teams: winners stay on their side, waiters + surviving losers form the opposing team.
	// If forced winners were displaced, their spots on the winner team need filling from surviving losers.
	const winnerTeam = [...survivingWinners.map((p) => p.id)];
	const opposingPool = [...waitingQueue.map((p) => p.id), ...survivingLosers.map((p) => p.id)];

	// Promote from opposing pool to winner team if it's short
	while (winnerTeam.length < teamSize && opposingPool.length >= teamSize) {
		winnerTeam.push(opposingPool.pop()!);
	}

	const finalHome = winnersOnHome ? winnerTeam : opposingPool;
	const finalAway = winnersOnHome ? opposingPool : winnerTeam;

	const constrained = enforceAlwaysSplit(finalHome, finalAway, alwaysSplitConstraints, players);

	return {
		homePlayerIds: constrained.homeIds,
		awayPlayerIds: constrained.awayIds,
		rotatedOut,
		coinTossNeeded: null,
	};
}
