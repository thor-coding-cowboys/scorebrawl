import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export const SCORE_TYPES = ["elo", "3-1-0", "1-v-n-elo"] as const;
export type ScoreType = (typeof SCORE_TYPES)[number];

export const SCORE_TYPE_CONFIG: Record<
	ScoreType,
	{
		label: string;
		description: string;
		color: string;
		icon: Parameters<typeof SymbolView>[0]["name"];
	}
> = {
	elo: {
		label: "ELO Standard",
		description: "Dynamic skill-based rating system",
		color: "#10b981",
		icon: { ios: "trophy.fill", android: "emoji_events", web: "emoji_events" },
	},
	"1-v-n-elo": {
		label: "ELO 1-v-N",
		description: "One winner, everyone else loses",
		color: "#a855f7",
		icon: { ios: "person.3.fill", android: "groups", web: "groups" },
	},
	"3-1-0": {
		label: "Points (3-1-0)",
		description: "Win 3 • Draw 1 • Loss 0",
		color: "#3b82f6",
		icon: { ios: "target", android: "track_changes", web: "track_changes" },
	},
};

export function ScoreTypeCard({
	type,
	selected,
	onPress,
	disabled,
}: {
	type: ScoreType;
	selected: boolean;
	onPress: () => void;
	disabled: boolean;
}) {
	const theme = useTheme();
	const config = SCORE_TYPE_CONFIG[type];
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected, disabled }}
			onPress={onPress}
			disabled={disabled}
			style={({ pressed }) => [
				styles.scoreCard,
				{
					borderColor: selected ? config.color : theme.border,
					backgroundColor: selected ? `${config.color}14` : theme.background,
					opacity: disabled ? 0.6 : 1,
				},
				pressed && !disabled && { opacity: 0.7 },
			]}
		>
			{selected && <View style={[styles.scoreCardAccent, { backgroundColor: config.color }]} />}
			<View style={[styles.scoreIcon, { backgroundColor: `${config.color}20` }]}>
				<SymbolView name={config.icon} size={20} tintColor={config.color} />
			</View>
			<View style={styles.scoreText}>
				<ThemedText type="smallBold" style={{ color: selected ? config.color : theme.text }}>
					{config.label}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					{config.description}
				</ThemedText>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	scoreCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		borderWidth: 2,
		borderRadius: 0,
		padding: Spacing.three,
		overflow: "hidden",
	},
	scoreCardAccent: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 3,
	},
	scoreIcon: {
		width: 40,
		height: 40,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	scoreText: {
		flex: 1,
		gap: 2,
	},
});
