export interface MatchDisplayPlayer {
	id: string;
	name: string;
	image: string | null;
	teamName: string | null;
	teamLogo: string | null;
	homeTeam: boolean;
}

export function getTeamInfo(
	players: MatchDisplayPlayer[]
): { name: string; logo: string | null } | null {
	if (players.length <= 1) return null;
	const teamName = players[0]?.teamName;
	const teamLogo = players[0]?.teamLogo ?? null;
	if (teamName) return { name: teamName, logo: teamLogo };
	return { name: players.map((p) => p.name.split(" ")[0]).join(" & "), logo: teamLogo };
}

export function getSideLabel(players: MatchDisplayPlayer[]): string {
	if (players.length === 0) return "Unknown";
	const teamInfo = getTeamInfo(players);
	if (teamInfo) return teamInfo.name;
	return players.map((p) => p.name).join(", ");
}

export function buildMatchResultToast(opts: {
	scoreType: string;
	players: MatchDisplayPlayer[];
	homeScore: number;
	awayScore: number;
}): string {
	const home = opts.players.filter((p) => p.homeTeam);
	const away = opts.players.filter((p) => !p.homeTeam);

	if (opts.scoreType === "1-v-n-elo") {
		return `${getSideLabel(home)} won the match`;
	}

	return `${getSideLabel(home)} ${opts.homeScore}–${opts.awayScore} ${getSideLabel(away)}`;
}
