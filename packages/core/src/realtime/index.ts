import type { AchievementType } from "../achievements";
import type { MatchDisplayPlayer } from "../presentation";

export interface SeasonRealtimeUser {
	id: string;
	name: string;
}

export interface SeasonRealtimeStreakData {
	playerId?: string;
	playerName?: string;
	playerImage?: string | null;
	streak?: number;
	timestamp?: number;
	isTeam?: boolean;
}

export interface SeasonRealtimeSessionData {
	sessionId?: string;
	session?: { id: string };
	autoEndsAt?: string | Date | null;
	match?: { id?: string; homeScore?: number; awayScore?: number };
	players?: unknown;
	proposedLineup?: unknown;
	teamSelection?: unknown;
	resolvedCoinToss?: unknown;
	settings?: unknown;
	player?: unknown;
	removedSessionPlayerId?: string;
}

export interface SeasonRealtimeScoreUpdateData {
	sessionId?: string;
	sessionMatchId?: string;
	homeScore?: number;
	awayScore?: number;
}

export interface SeasonRealtimeMatchData {
	match: {
		id: string;
		seasonId: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date | string;
	};
	scoreType: string;
	players: MatchDisplayPlayer[];
}

export interface SeasonRealtimeMatchDeleteData {
	matchId?: string | null;
}

export type StandingsUpdateReason =
	| "match:create"
	| "match:remove"
	| "session:record-result"
	| "session:delete-last-match";

export interface SeasonStandingsUpdateData {
	reason: StandingsUpdateReason;
	matchId?: string;
	sessionId?: string;
}

export interface SeasonAchievementUnlockData {
	player: { id: string; name: string; image: string | null };
	type: AchievementType;
}

interface SeasonRealtimeEventPayloads {
	connected: undefined;
	streak: SeasonRealtimeStreakData;
	"session:start": SeasonRealtimeSessionData;
	"session:end": SeasonRealtimeSessionData;
	"session:update": SeasonRealtimeSessionData;
	"session:score-update": SeasonRealtimeScoreUpdateData;
	"match:insert": SeasonRealtimeMatchData;
	"match:delete": SeasonRealtimeMatchDeleteData;
	"standings:update": SeasonStandingsUpdateData;
	"achievement:unlock": SeasonAchievementUnlockData;
}

export type SeasonRealtimeEventType = keyof SeasonRealtimeEventPayloads;

type SeasonRealtimeEventOf<K extends SeasonRealtimeEventType> =
	SeasonRealtimeEventPayloads[K] extends undefined
		? { type: K; data?: undefined; user?: SeasonRealtimeUser }
		: { type: K; data: SeasonRealtimeEventPayloads[K]; user?: SeasonRealtimeUser };

export type SeasonRealtimeEvent = {
	[K in SeasonRealtimeEventType]: SeasonRealtimeEventOf<K>;
}[SeasonRealtimeEventType];
