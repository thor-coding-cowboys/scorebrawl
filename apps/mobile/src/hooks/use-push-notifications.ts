import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";
import { routeNotificationResponse } from "@/lib/notification-routing";
import { registerForPushNotifications } from "@/lib/notifications";

function usePushRegistration() {
	const { data } = authClient.useSession();
	const userId = data?.session?.userId ?? null;

	useEffect(() => {
		if (userId) {
			void registerForPushNotifications();
		}
	}, [userId]);
}

export function usePushNotifications() {
	const router = useRouter();
	const queryClient = useQueryClient();

	usePushRegistration();

	useEffect(() => {
		const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
			void routeNotificationResponse(response, router, queryClient);
		});

		void Notifications.getLastNotificationResponseAsync()
			.then(async (response) => {
				if (!response) return;
				await Notifications.clearLastNotificationResponseAsync().catch(() => {});
				await routeNotificationResponse(response, router, queryClient);
			})
			.catch((error) => {
				console.warn("[Push] Unable to read last notification response", error);
			});

		return () => subscription.remove();
	}, [router, queryClient]);
}
