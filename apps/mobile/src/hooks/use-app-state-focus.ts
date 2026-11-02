import { focusManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { AppStateStatus } from "react-native";

export function useAppStateFocus() {
	useEffect(() => {
		if (Platform.OS === "web") return;

		const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
			focusManager.setFocused(status === "active");
		});

		return () => subscription.remove();
	}, []);
}
