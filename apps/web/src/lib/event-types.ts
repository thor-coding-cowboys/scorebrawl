export interface SessionEventDetail {
	type: "session:start" | "session:update" | "session:end";
	sessionId?: string;
	userName?: string;
}

export interface SessionScoreEventDetail {
	sessionId?: string;
	sessionMatchId?: string;
	homeScore?: number;
	awayScore?: number;
}

export interface StreakEventDetail {
	playerId?: string;
	playerName?: string;
	playerImage?: string | null;
	streak?: number;
	timestamp?: number;
	isTeam?: boolean;
}

export interface AchievementEventDetail {
	playerId: string;
	playerName: string;
	playerImage?: string | null;
	type: string;
	timestamp?: number;
}

declare global {
	interface WindowEventMap {
		"session-event": CustomEvent<SessionEventDetail>;
		"session-score-event": CustomEvent<SessionScoreEventDetail>;
		"streak-event": CustomEvent<StreakEventDetail>;
		"achievement-event": CustomEvent<AchievementEventDetail>;
	}
}
