import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { handleNotificationResponse } from "@/lib/notifications";

export function useNotificationObserver() {
	const router = useRouter();
	const queryClient = useQueryClient();

	useEffect(() => {
		const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
			void handleNotificationResponse(response, router, queryClient);
		});

		void Notifications.getLastNotificationResponseAsync()
			.then(async (response) => {
				if (!response) return;
				await Notifications.clearLastNotificationResponseAsync().catch(() => {});
				await handleNotificationResponse(response, router, queryClient);
			})
			.catch((error) => {
				console.warn("[Push] Unable to read last notification response", error);
			});

		return () => subscription.remove();
	}, [router, queryClient]);
}
