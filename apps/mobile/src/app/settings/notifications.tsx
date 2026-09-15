import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Card, CardContent } from "@/components/ui/card";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

type ToggleKey =
	| "notifySessionStarted"
	| "notifyMatchRecorded"
	| "notifyAchievementUnlocked"
	| "notifyStreakReached";

type NotificationSettingsPatch = Partial<Record<"pushEnabled" | ToggleKey, boolean>>;

const TOGGLES: Array<{ key: ToggleKey; label: string; description: string }> = [
	{
		key: "notifySessionStarted",
		label: "Session started",
		description: "When someone starts a session in your league",
	},
	{
		key: "notifyMatchRecorded",
		label: "Match recorded",
		description: "When a match result is recorded",
	},
	{
		key: "notifyAchievementUnlocked",
		label: "Achievement unlocked",
		description: "When an achievement is earned",
	},
	{
		key: "notifyStreakReached",
		label: "Streak reached",
		description: "When a player reaches a win streak",
	},
];

export default function NotificationSettingsScreen() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const theme = useTheme();

	const settingsQuery = useQuery(trpc.notification.getSettings.queryOptions());
	const updateSettings = useMutation(
		trpc.notification.updateSettings.mutationOptions({
			onSuccess: () => {
				void queryClient.invalidateQueries(trpc.notification.getSettings.queryOptions());
			},
		})
	);

	const settings = settingsQuery.data;

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<ScrollView contentContainerStyle={styles.scroll}>
					<Card>
						<CardContent style={styles.list}>
							<View style={[styles.row, { borderBottomColor: theme.border }]}>
								<View style={styles.rowInfo}>
									<ThemedText type="smallBold">Push notifications</ThemedText>
									<ThemedText type="small" themeColor="textSecondary">
										Master switch for all push notifications
									</ThemedText>
								</View>
								<Switch
									value={settings?.pushEnabled ?? false}
									disabled={!settings}
									onValueChange={(value) => updateSettings.mutate({ pushEnabled: value })}
								/>
							</View>

							{TOGGLES.map(({ key, label, description }) => (
								<View key={key} style={[styles.row, { borderBottomColor: theme.border }]}>
									<View style={styles.rowInfo}>
										<ThemedText type="smallBold">{label}</ThemedText>
										<ThemedText type="small" themeColor="textSecondary">
											{description}
										</ThemedText>
									</View>
									<Switch
										value={settings?.[key] ?? false}
										disabled={!settings?.pushEnabled}
										onValueChange={(value) =>
											updateSettings.mutate({ [key]: value } as NotificationSettingsPatch)
										}
									/>
								</View>
							))}
						</CardContent>
					</Card>
				</ScrollView>
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, flexDirection: "row", justifyContent: "center" },
	safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
	scroll: { paddingVertical: Spacing.three },
	list: { gap: 0, paddingHorizontal: 0, paddingBottom: 0 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
		paddingHorizontal: Spacing.four,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rowInfo: { flex: 1, gap: Spacing.one },
});
