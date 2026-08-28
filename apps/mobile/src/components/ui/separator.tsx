import { StyleSheet, Text, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Separator({ label }: { label?: string }) {
	const theme = useTheme();

	if (!label) {
		return <View style={[styles.line, { backgroundColor: theme.border }]} />;
	}

	return (
		<View style={styles.row}>
			<View style={[styles.line, { backgroundColor: theme.border }]} />
			<Text style={[styles.label, { color: theme.mutedForeground }]}>{label}</Text>
			<View style={[styles.line, { backgroundColor: theme.border }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		marginVertical: Spacing.four,
	},
	line: {
		flex: 1,
		height: StyleSheet.hairlineWidth,
	},
	label: {
		fontSize: 12,
		fontWeight: "600",
		textTransform: "uppercase",
		lineHeight: 16,
	},
});
