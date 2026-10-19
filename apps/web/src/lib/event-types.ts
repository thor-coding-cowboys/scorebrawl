import type {
	SessionEventDetail,
	SessionScoreEventDetail,
} from "@coding-cowboys/scorebrawl-client/realtime";

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
