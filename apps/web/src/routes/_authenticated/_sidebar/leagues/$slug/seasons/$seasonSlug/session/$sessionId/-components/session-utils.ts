import type { GameSession, SessionPlayer } from "./session-types";

export function computeWinStreaks(session: GameSession): Map<string, number> {
	const streaks = new Map<string, number>();
	const completed = session.matches
		.filter((m) => m.result === "home" || m.result === "away")
		.sort((a, b) => a.matchNumber - b.matchNumber);

	for (const player of session.players) {
		streaks.set(player.seasonPlayerId, 0);
	}

	for (const player of session.players) {
		let streak = 0;
		for (let i = completed.length - 1; i >= 0; i--) {
			const m = completed[i];
			const isHome = m.homePlayerIds.includes(player.seasonPlayerId);
			const isAway = m.awayPlayerIds.includes(player.seasonPlayerId);
			if (!isHome && !isAway) continue;
			const won = (isHome && m.result === "home") || (isAway && m.result === "away");
			if (won) {
				streak++;
			} else {
				break;
			}
		}
		streaks.set(player.seasonPlayerId, streak);
	}

	return streaks;
}

export function getPlayerById(
	session: GameSession,
	sessionPlayerId: string
): SessionPlayer | undefined {
	return session.players.find((p) => p.id === sessionPlayerId);
}

export function getPlayerBySeasonId(
	session: GameSession,
	seasonPlayerId: string
): SessionPlayer | undefined {
	return session.players.find((p) => p.seasonPlayerId === seasonPlayerId);
}

export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function enforceAlwaysSplit(
	homeIds: string[],
	awayIds: string[],
	constraints: [string, string][],
	players: SessionPlayer[]
): { homeIds: string[]; awayIds: string[] } {
	if (constraints.length === 0) return { homeIds, awayIds };
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

	let changed = true;
	while (changed) {
		changed = false;
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

			const swapPartner = [...otherTeam].find((id) => !isConstrained(id, stayTarget.id));
			if (swapPartner) {
				sameTeam.delete(swapTarget.id);
				otherTeam.add(swapTarget.id);
				otherTeam.delete(swapPartner);
				sameTeam.add(swapPartner);
				changed = true;
			}
		}
	}

	return { homeIds: [...home], awayIds: [...away] };
}
