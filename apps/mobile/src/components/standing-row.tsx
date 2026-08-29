import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";

export type StandingItem = {
	id: string;
	name: string;
	image?: string | null;
	score: number;
	matchCount: number;
	winCount: number;
	pointDiff: number;
};

function winPct(item: StandingItem) {
	return item.matchCount > 0 ? Math.round((item.winCount / item.matchCount) * 100) : 0;
}

export function StandingRow({
	item,
	rank,
	headers,
}: {
	item: StandingItem;
	rank: number;
	headers?: Record<string, string>;
}) {
	const diffColor = item.pointDiff > 0 ? "#16a34a" : item.pointDiff < 0 ? "#dc2626" : undefined;

	return (
		<View style={styles.row}>
			<ThemedText type="small" themeColor="textSecondary" style={styles.rank}>
				{rank}
			</ThemedText>
			<Avatar name={item.name} image={getAvatarUri(item.image)} headers={headers} size={32} />
			<View style={styles.info}>
				<ThemedText numberOfLines={1} style={styles.name}>
					{item.name}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					{item.matchCount} MP · {winPct(item)}% W
				</ThemedText>
			</View>
			<View style={styles.right}>
				<ThemedText type="subtitle" style={styles.score}>
					{item.score}
				</ThemedText>
				<ThemedText
					type="small"
					themeColor="textSecondary"
					style={diffColor ? { color: diffColor } : undefined}
				>
					{item.pointDiff > 0 ? `+${item.pointDiff}` : item.pointDiff}
				</ThemedText>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
	},
	rank: {
		width: 24,
		textAlign: "center",
	},
	info: {
		flex: 1,
	},
	name: {
		fontWeight: "600",
	},
	right: {
		alignItems: "flex-end",
	},
	score: {
		fontWeight: "700",
	},
});
