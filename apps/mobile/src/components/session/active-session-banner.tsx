import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { rotationLabel } from "@/components/session/utils";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

export function ActiveSessionBanner({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const theme = useTheme();
	const { data: session } = useQuery(trpc.session.getActive.queryOptions({ seasonSlug }));

	if (!session || session.status !== "active") return null;

	return (
		<Pressable
			onPress={() =>
				router.push({
					pathname: "/seasons/[seasonSlug]/session/[sessionId]",
					params: { seasonSlug, sessionId: session.id, view: "next" },
				})
			}
			style={({ pressed }) => [
				styles.banner,
				{
					backgroundColor: theme.glowBlueBg,
					borderColor: theme.glowBlueBorder,
					opacity: pressed ? 0.85 : 1,
				},
			]}
		>
			<View style={styles.liveDot} />
			<View style={styles.info}>
				<ThemedText type="smallBold" style={{ color: theme.glowBlueText }}>
					Session in progress
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					{rotationLabel(session.rotationMode)} · {session.players.length} players ·{" "}
					{session.teamSize}v{session.teamSize}
				</ThemedText>
			</View>
			<SymbolView
				name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
				size={16}
				tintColor={theme.glowBlueText}
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	banner: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		borderRadius: 0,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.four,
		paddingVertical: Spacing.three,
		marginHorizontal: -Spacing.four,
		marginBottom: Spacing.three,
	},
	liveDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#22c55e",
	},
	info: { flex: 1, gap: 1 },
});
