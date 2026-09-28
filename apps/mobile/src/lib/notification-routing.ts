import type { QueryClient } from "@tanstack/react-query";
import type { NotificationPayload } from "@coding-cowboys/scorebrawl-worker/services/notification-payload";
import type { useRouter } from "expo-router";
import type * as Notifications from "expo-notifications";
import { authClient } from "./auth-client";

function parseNotificationPayload(value: unknown): NotificationPayload | null {
	if (typeof value !== "object" || value === null) return null;

	const record = value as Record<string, unknown>;
	const leagueSlug = typeof record.leagueSlug === "string" ? record.leagueSlug : null;
	const seasonSlug = typeof record.seasonSlug === "string" ? record.seasonSlug : null;

	switch (record.type) {
		case "session:start": {
			const sessionId = typeof record.sessionId === "string" ? record.sessionId : null;
			if (!leagueSlug || !seasonSlug || !sessionId) return null;
			return { type: "session:start", leagueSlug, seasonSlug, sessionId };
		}
		case "match:recorded": {
			const matchId = typeof record.matchId === "string" ? record.matchId : null;
			if (!leagueSlug || !seasonSlug || !matchId) return null;
			return { type: "match:recorded", leagueSlug, seasonSlug, matchId };
		}
		case "achievement:unlock":
		case "streak": {
			const playerId = typeof record.playerId === "string" ? record.playerId : null;
			if (!leagueSlug || !seasonSlug || !playerId) return null;
			return { type: record.type, leagueSlug, seasonSlug, playerId };
		}
		default:
			return null;
	}
}

export async function routeNotificationResponse(
	response: Notifications.NotificationResponse,
	router: ReturnType<typeof useRouter>,
	queryClient: QueryClient
): Promise<void> {
	const payload = parseNotificationPayload(response.notification.request.content.data);
	if (!payload) return;

	try {
		const { data: organizations } = await authClient.organization.list();
		const organization = organizations?.find((candidate) => candidate.slug === payload.leagueSlug);
		if (!organization) return;

		await authClient.organization.setActive({ organizationId: organization.id });
		await authClient.getSession();
		await queryClient.invalidateQueries();

		switch (payload.type) {
			case "session:start":
				router.push({
					pathname: "/seasons/[seasonSlug]/session/[sessionId]",
					params: { seasonSlug: payload.seasonSlug, sessionId: payload.sessionId },
				});
				break;
			case "match:recorded":
				router.push({
					pathname: "/seasons/[seasonSlug]",
					params: { seasonSlug: payload.seasonSlug },
				});
				break;
			case "achievement:unlock":
			case "streak":
				router.push({ pathname: "/players/[playerId]", params: { playerId: payload.playerId } });
				break;
		}
	} catch (error) {
		console.warn("[Push] Unable to route notification response", error);
	}
}
