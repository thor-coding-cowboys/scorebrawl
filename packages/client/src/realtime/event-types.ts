export type SessionEventType = "session:start" | "session:update" | "session:end";

export interface SessionEventDetail {
	type: SessionEventType;
	sessionId?: string;
	userName?: string;
}

export interface SessionScoreEventDetail {
	sessionId?: string;
	sessionMatchId?: string;
	homeScore?: number;
	awayScore?: number;
}

export interface SessionScoreUpdate {
	sessionMatchId?: string;
	homeScore: number;
	awayScore: number;
}
