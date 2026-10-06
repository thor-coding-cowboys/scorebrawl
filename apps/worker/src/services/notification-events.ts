import type { NotificationPayload } from "./notification-payload";

export type PushEvent = {
	title: string;
	body: string;
	payload: NotificationPayload;
	excludeUserId?: string;
};

type Payload<T extends NotificationPayload["type"]> = Extract<NotificationPayload, { type: T }>;

export function sessionStarted(
	payload: Payload<"session:start">,
	context: { actorId: string; actorName: string; leagueName: string }
): PushEvent {
	return {
		title: "Session started",
		body: `${context.actorName} started a session in ${context.leagueName}`,
		excludeUserId: context.actorId,
		payload,
	};
}

export function matchRecorded(
	payload: Payload<"match:recorded">,
	context: { actorId: string; actorName: string; summary: string | null }
): PushEvent {
	return {
		title: "Match recorded",
		body: context.summary ?? `${context.actorName} recorded a match`,
		excludeUserId: context.actorId,
		payload,
	};
}

export function achievementUnlocked(
	payload: Payload<"achievement:unlock">,
	context: { playerName: string; achievementType: string }
): PushEvent {
	return {
		title: "Achievement unlocked",
		body: `${context.playerName} earned ${context.achievementType.replace(/_/g, " ")}`,
		payload,
	};
}

export function buildStreakPushEvents(
	players: Array<{ playerId: string; playerName: string; streak: number }>,
	context: { leagueSlug: string; seasonSlug: string }
): PushEvent[] {
	return players.map((player) => {
		const count = Math.abs(player.streak);
		const label = player.streak > 0 ? "win" : "losing";
		return {
			title: "Streak reached",
			body: `${player.playerName} is on a ${count}-game ${label} streak`,
			payload: {
				type: "streak",
				leagueSlug: context.leagueSlug,
				seasonSlug: context.seasonSlug,
				playerId: player.playerId,
			},
		};
	});
}

export function formatMatchSummary(
	players: Array<{ name: string; teamName: string | null; homeTeam: boolean }>,
	homeScore: number,
	awayScore: number
): string | null {
	const label = (homeTeam: boolean) =>
		players
			.filter((player) => player.homeTeam === homeTeam)
			.map((player) => player.teamName ?? player.name)
			.join(" & ");

	const home = label(true);
	const away = label(false);

	return home && away ? `${home} ${homeScore}–${awayScore} ${away}` : null;
}
