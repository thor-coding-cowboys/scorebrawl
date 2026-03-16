export interface SessionEventDetail {
	type: "session:start" | "session:update" | "session:end";
	sessionId?: string;
	userName?: string;
}

export interface StreakEventDetail {
	playerId?: string;
	playerName?: string;
	playerImage?: string | null;
	streak?: number;
	timestamp?: number;
	isTeam?: boolean;
}

declare global {
	interface WindowEventMap {
		"session-event": CustomEvent<SessionEventDetail>;
		"streak-event": CustomEvent<StreakEventDetail>;
	}
}
