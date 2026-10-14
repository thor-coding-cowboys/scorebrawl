import type { GameSession } from "./types";

export type NextLineup = { homeIds: string[]; awayIds: string[] };

export function getNextLineup(
	session: Pick<GameSession, "players" | "matches" | "proposedLineup" | "teamSize">
): NextLineup | null {
	if (session.matches.some((m) => m.result === null)) return null;

	const lineup = session.proposedLineup;
	if (!lineup) return null;

	const homeIds = resolveIds(lineup.selectedHomePlayerIds, lineup.homePlayerIds, session);
	const awayIds = resolveIds(lineup.selectedAwayPlayerIds, lineup.awayPlayerIds, session);

	if (homeIds.length !== session.teamSize || awayIds.length !== session.teamSize) {
		return null;
	}
	return { homeIds, awayIds };
}

function resolveIds(
	selected: string[] | undefined,
	fallback: string[],
	session: Pick<GameSession, "players">
): string[] {
	const source = selected && selected.length > 0 ? selected : fallback;
	const known = new Set(session.players.map((p) => p.id));
	return source.filter((id) => known.has(id));
}

export function lineupSignature(lineup: NextLineup): string {
	return `${[...lineup.homeIds].sort().join(",")}|${[...lineup.awayIds].sort().join(",")}`;
}

export function buildAnnouncement(
	session: Pick<GameSession, "players">,
	lineup: NextLineup
): string {
	const nameById = new Map(session.players.map((p) => [p.id, p.displayName]));
	const home = formatNames(lineup.homeIds.map((id) => nameById.get(id) ?? ""));
	const away = formatNames(lineup.awayIds.map((id) => nameById.get(id) ?? ""));
	return `Next game: ${home} versus ${away}`;
}

function formatNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? "";
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
