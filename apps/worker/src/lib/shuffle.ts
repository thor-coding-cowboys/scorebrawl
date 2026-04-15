export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i]!, result[j]!] = [result[j]!, result[i]!];
	}
	return result;
}

export function diversityShuffle<T>(items: T[], pairWeights: Map<string, number>): T[] {
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
