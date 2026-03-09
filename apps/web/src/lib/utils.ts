import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}…`;
}

export function formatDuration(start: Date, end: Date | null): string {
	if (!end) return "In progress";
	const ms = new Date(end).getTime() - new Date(start).getTime();
	const minutes = Math.floor(ms / 60000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function rotationLabel(mode: string): string {
	switch (mode) {
		case "winner-stays":
			return "Winner Stays";
		case "round-robin":
			return "Round Robin";
		case "manual":
			return "Manual";
		default:
			return mode;
	}
}
