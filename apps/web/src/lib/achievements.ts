export function formatAchievementName(type: string): string {
	return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
