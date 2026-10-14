import { oklchToHex, themes } from "../theme";

const formHex = (key: "win" | "draw" | "loss"): string => {
	const hex = oklchToHex(themes.light.form[key]);
	if (!hex) throw new Error(`Form token is not convertible to hex: ${key}`);
	return hex;
};

export type StandingFormResult = "W" | "D" | "L";

export type StandingItem = {
	id: string;
	playerId?: string;
	name: string;
	image?: string | null;
	score: number;
	matchCount: number;
	winCount: number;
	pointDiff: number;
	form?: StandingFormResult[];
};

export function winPct(item: Pick<StandingItem, "matchCount" | "winCount">): number {
	return item.matchCount > 0 ? Math.round((item.winCount / item.matchCount) * 100) : 0;
}

export function compareStandings(
	a: Pick<StandingItem, "matchCount" | "score">,
	b: Pick<StandingItem, "matchCount" | "score">
): number {
	if (a.matchCount === 0 && b.matchCount !== 0) return 1;
	if (a.matchCount !== 0 && b.matchCount === 0) return -1;
	return b.score - a.score;
}

export function sortStandings<T extends Pick<StandingItem, "matchCount" | "score">>(
	items: readonly T[]
): T[] {
	return [...items].sort(compareStandings);
}

export function calculateStreak(form?: readonly StandingFormResult[]): number {
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

export type StreakType = "fire" | "ice" | "none";

export const STREAK_FIRE_THRESHOLD = 5;
export const STREAK_ICE_THRESHOLD = -5;

export function getStreakType(streak: number): StreakType {
	if (streak >= STREAK_FIRE_THRESHOLD) return "fire";
	if (streak <= STREAK_ICE_THRESHOLD) return "ice";
	return "none";
}

export const FORM_COLORS: Record<StandingFormResult, string> = {
	W: formHex("win"),
	D: formHex("draw"),
	L: formHex("loss"),
};
