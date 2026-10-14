export const DEFAULT_LEAGUE_LOGO = "https://avatars.githubusercontent.com/u/246662916";

export type SeasonStatus = "active" | "upcoming" | "ended" | "locked" | "archived";

export interface SeasonStatusInput {
	archived: boolean;
	closed: boolean;
	startDate: Date | string;
	endDate: Date | string | null | undefined;
}

export function getSeasonStatus(season: SeasonStatusInput): SeasonStatus {
	if (season.archived) return "archived";
	if (season.closed) return "locked";

	const now = new Date();
	const startDate = new Date(season.startDate);
	const endDate = season.endDate ? new Date(season.endDate) : null;

	if (startDate > now) return "upcoming";
	if (endDate && endDate < now) return "ended";
	return "active";
}

export function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
