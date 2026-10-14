import type { GameSession, SessionPlayer } from "./types";

export function computeWinStreaks(
	session: Pick<GameSession, "players" | "matches">
): Map<string, number> {
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
	session: Pick<GameSession, "players">,
	sessionPlayerId: string
): SessionPlayer | undefined {
	return session.players.find((p) => p.id === sessionPlayerId);
}

export function getPlayerBySeasonId(
	session: Pick<GameSession, "players">,
	seasonPlayerId: string
): SessionPlayer | undefined {
	return session.players.find((p) => p.seasonPlayerId === seasonPlayerId);
}
