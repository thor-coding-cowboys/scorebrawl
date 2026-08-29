import type { DrawerContentComponentProps } from "expo-router/drawer";
import { ThemedView } from "@/components/themed-view";

export function LeagueDrawerContent(_props: DrawerContentComponentProps) {
	return <ThemedView style={{ flex: 1 }} />;
}
