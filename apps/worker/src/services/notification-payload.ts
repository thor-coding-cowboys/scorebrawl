export type NotificationPayload =
	| { type: "session:start"; leagueSlug: string; seasonSlug: string; sessionId: string }
	| { type: "match:recorded"; leagueSlug: string; seasonSlug: string; matchId: string }
	| { type: "achievement:unlock"; leagueSlug: string; seasonSlug: string; playerId: string }
	| { type: "streak"; leagueSlug: string; seasonSlug: string; playerId: string };

export type NotificationEventType = NotificationPayload["type"];
