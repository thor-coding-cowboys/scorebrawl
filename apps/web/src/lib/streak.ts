export function calculateStreak(form?: ("W" | "D" | "L")[]): number {
	if (!form || form.length === 0) return 0;
	let streak = 0;
	const first = form[0];
	for (const result of form) {
		if (result === first) {
			streak += first === "W" ? 1 : first === "L" ? -1 : 0;
		} else {
			break;
		}
	}
	return streak;
}
