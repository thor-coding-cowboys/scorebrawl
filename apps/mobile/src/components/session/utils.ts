export function formatDuration(start: Date, end: Date | null): string {
	if (!end) return "In progress";
	const minutes = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remaining = minutes % 60;
	return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function rotationLabel(mode: string): string {
	if (mode === "winner-stays") return "Winner Stays";
	if (mode === "manual") return "Manual";
	return mode;
}
