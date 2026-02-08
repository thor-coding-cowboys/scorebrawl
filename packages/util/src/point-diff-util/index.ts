export interface MatchPlayerData {
	seasonPlayerId: string;
	scoreAfter: number;
	scoreBefore: number;
}

/**
 * Calculate point differences for players from their matches today
 * Groups matches by seasonPlayerId and sums up the net point changes
 */
export const calculatePointDiffs = (
	matches: MatchPlayerData[]
): { seasonPlayerId: string; pointDiff: number }[] => {
	const pointDiffMap = new Map<string, number>();

	for (const match of matches) {
		const currentDiff = pointDiffMap.get(match.seasonPlayerId) || 0;
		const matchDiff = match.scoreAfter - match.scoreBefore;
		pointDiffMap.set(match.seasonPlayerId, currentDiff + matchDiff);
	}

	const result: { seasonPlayerId: string; pointDiff: number }[] = [];
	for (const [seasonPlayerId, diff] of pointDiffMap) {
		result.push({ seasonPlayerId, pointDiff: diff });
	}

	return result;
};

/**
 * Get point difference for a specific player from the calculated diffs
 */
export const getPointDiffForPlayer = (
	pointDiffs: { seasonPlayerId: string; pointDiff: number }[],
	seasonPlayerId: string
): number => {
	return pointDiffs.find((pd) => pd.seasonPlayerId === seasonPlayerId)?.pointDiff ?? 0;
};

/**
 * Calculate recent form (last N match results) for a player
 * Takes raw match results and returns the last N results
 */
export const calculateRecentForm = (
	allResults: { seasonPlayerId: string; result: "W" | "D" | "L" }[],
	seasonPlayerId: string,
	limit = 5
): ("W" | "D" | "L")[] => {
	const playerResults = allResults
		.filter((r) => r.seasonPlayerId === seasonPlayerId)
		.map((r) => r.result);

	return playerResults.slice(0, limit);
};

/**
 * Group match results by player for form calculation
 */
export const groupResultsByPlayer = (
	allResults: { seasonPlayerId: string; result: "W" | "D" | "L"; createdAt: Date | number }[]
): Record<string, ("W" | "D" | "L")[]> => {
	// Sort by createdAt descending
	const sorted = [...allResults].sort((a, b) => {
		const aTime = typeof a.createdAt === "number" ? a.createdAt : a.createdAt.getTime();
		const bTime = typeof b.createdAt === "number" ? b.createdAt : b.createdAt.getTime();
		return bTime - aTime;
	});

	return sorted.reduce(
		(acc, match) => {
			if (!acc[match.seasonPlayerId]) {
				acc[match.seasonPlayerId] = [];
			}
			if (acc[match.seasonPlayerId].length < 5) {
				acc[match.seasonPlayerId].push(match.result);
			}
			return acc;
		},
		{} as Record<string, ("W" | "D" | "L")[]>
	);
};
