export interface SessionEventDetail {
	type: "session:start" | "session:update" | "session:end";
	sessionId?: string;
}

export interface StreakEventDetail {
	playerId?: string;
	playerName?: string;
	playerImage?: string | null;
	streak?: number;
	timestamp?: number;
	isTeam?: boolean;
}

export interface ScoreUpdateDetail {
	sessionId: string;
	sessionMatchId: string;
	homeScore: number;
	awayScore: number;
}

export interface TeamSelectionUpdateDetail {
	sessionId: string;
	sessionMatchId: string;
	selectedHomePlayerIds: string[];
	selectedAwayPlayerIds: string[];
}

export interface ProposedLineupUpdateDetail {
	sessionId: string;
	proposedLineup: {
		homePlayerIds: string[];
		awayPlayerIds: string[];
		rotatedOut: string[];
		coinTossNeeded: { conflictType: string; candidates: string[] } | null;
		selectedHomePlayerIds: string[];
		selectedAwayPlayerIds: string[];
	};
}

declare global {
	interface WindowEventMap {
		"session-event": CustomEvent<SessionEventDetail>;
		"streak-event": CustomEvent<StreakEventDetail>;
		"score-update": CustomEvent<ScoreUpdateDetail>;
		"team-selection-update": CustomEvent<TeamSelectionUpdateDetail>;
		"proposed-lineup-update": CustomEvent<ProposedLineupUpdateDetail>;
	}
}
