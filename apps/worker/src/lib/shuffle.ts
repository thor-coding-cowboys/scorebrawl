export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const shuffled = [...arr];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

export function diversityShuffle<T>(
	items: T[],
	pairWeights: Map<string, number>,
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

export function diversityShuffleWithHistory(
	playerIds: string[],
	matchHistory: Array<{ homePlayerIds: string[]; awayPlayerIds: string[] }>,
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
