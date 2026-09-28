import type { RouterOutput } from "@/lib/trpc";

type Season = RouterOutput["season"]["getAll"][number];

type SeasonStatusInput = Pick<Season, "archived" | "closed" | "startDate" | "endDate">;

export function getSeasonStatus(
	season: SeasonStatusInput
): "active" | "upcoming" | "ended" | "locked" | "archived" {
	if (season.archived) return "archived";
	if (season.closed) return "locked";

	const now = new Date();
	const startDate = new Date(season.startDate);
	const endDate = season.endDate ? new Date(season.endDate) : null;

	if (startDate > now) return "upcoming";
	if (endDate && endDate < now) return "ended";
	return "active";
}

export function formatDate(date: Date) {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
