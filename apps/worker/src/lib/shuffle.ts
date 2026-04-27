export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const shuffled = [...arr];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

function getPairKey<T>(a: T, b: T): string {
	return [a, b].sort().join("|");
}

function calculateTeamScore<T>(team: T[], pairWeights: Map<string, number>): number {
	let score = 0;
	for (let i = 0; i < team.length; i++) {
		for (let j = i + 1; j < team.length; j++) {
			const key = getPairKey(team[i], team[j]);
			score += pairWeights.get(key) || 0;
		}
	}
	return score;
}

function generateTeamSplits<T>(players: T[], teamSize: number): Array<[T[], T[]]> {
	const splits: Array<[T[], T[]]> = [];
	const n = players.length;

	const generateCombinations = (start: number, current: T[], mask: number) => {
		if (current.length === teamSize) {
			const team1 = [...current];
			const team2: T[] = [];
			for (let i = 0; i < n; i++) {
				if (!(mask & (1 << i))) {
					team2.push(players[i]);
				}
			}
			if (team2.length === teamSize) {
				splits.push([team1, team2]);
			}
			return;
		}

		for (let i = start; i < n; i++) {
			current.push(players[i]);
			generateCombinations(i + 1, current, mask | (1 << i));
			current.pop();
		}
	};

	generateCombinations(0, [], 0);
	return splits;
}

export function diversityShuffle<T>(items: T[], pairWeights: Map<string, number>): T[] {
	if (items.length <= 1) {
		return [...items];
	}

	const teamSize = items.length <= 2 ? 1 : Math.floor(items.length / 2);

	// For very small arrays, enumerate all possible team splits
	if (items.length <= 6) {
		const splits = generateTeamSplits(items, teamSize);

		// Score each split
		const scored = splits.map(([team1, team2]) => {
			const score = calculateTeamScore(team1, pairWeights) + calculateTeamScore(team2, pairWeights);
			return { team1, team2, score };
		});

		const maxScore = Math.max(...scored.map((s) => s.score));

		// Use weighted random selection: lower scores get higher probability
		// but ALL splits have a chance (unlike filtering to only best)
		// Linear weighting with +1 offset gives roughly 30% chance of same teams after 1 match
		const weightOf = (score: number) => maxScore - score + 1;
		const totalWeight = scored.reduce((sum, s) => sum + weightOf(s.score), 0);

		let random = Math.random() * totalWeight;
		let selected = scored[0];

		for (const s of scored) {
			random -= weightOf(s.score);
			if (random < 0) {
				selected = s;
				break;
			}
		}

		// Return as a shuffled array: team1 first, then team2
		// Shuffle within each team to add randomness
		return [...fisherYatesShuffle(selected.team1), ...fisherYatesShuffle(selected.team2)];
	}

	// For larger arrays, fall back to greedy approach
	return diversityShuffleGreedy(items, pairWeights);
}

function diversityShuffleGreedy<T>(items: T[], pairWeights: Map<string, number>): T[] {
	const result: T[] = [];
	const remaining = [...items];

	while (remaining.length > 0) {
		const scored = remaining.map((item) => {
			let totalWeight = 0;
			for (const placed of result) {
				const key = getPairKey(item, placed);
				totalWeight += pairWeights.get(key) || 0;
			}
			return { item, score: totalWeight };
		});

		const maxScore = scored.reduce((max, s) => Math.max(max, s.score), 0);
		const weightOf = (score: number) => Math.pow(10, maxScore - score);
		const totalWeight = scored.reduce((sum, s) => sum + weightOf(s.score), 0);
		let random = Math.random() * totalWeight;
		let selected = scored[0];

		for (const s of scored) {
			random -= weightOf(s.score);
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
	matchHistory: Array<{ homePlayerIds: string[]; awayPlayerIds: string[] }>
): string[] {
	const pairWeights = new Map<string, number>();

	for (const match of matchHistory) {
		// Only add weights for teammates (players on the same team)
		// Home team teammates
		for (let i = 0; i < match.homePlayerIds.length; i++) {
			for (let j = i + 1; j < match.homePlayerIds.length; j++) {
				const key = getPairKey(match.homePlayerIds[i]!, match.homePlayerIds[j]!);
				pairWeights.set(key, (pairWeights.get(key) || 0) + 1);
			}
		}
		// Away team teammates
		for (let i = 0; i < match.awayPlayerIds.length; i++) {
			for (let j = i + 1; j < match.awayPlayerIds.length; j++) {
				const key = getPairKey(match.awayPlayerIds[i]!, match.awayPlayerIds[j]!);
				pairWeights.set(key, (pairWeights.get(key) || 0) + 1);
			}
		}
	}

	return diversityShuffle(playerIds, pairWeights);
}
