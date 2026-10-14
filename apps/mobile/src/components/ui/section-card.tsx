import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function SectionCard({
	title,
	right,
	children,
}: {
	title?: ReactNode;
	right?: ReactNode;
	children: ReactNode;
}) {
	const theme = useTheme();
	return (
		<View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
			{title || right ? (
				<View style={styles.header}>
					{typeof title === "string" ? (
						<ThemedText type="smallBold" style={styles.title}>
							{title}
						</ThemedText>
					) : (
						<View style={styles.titleSlot}>{title}</View>
					)}
					{right}
				</View>
			) : null}
			<View style={styles.body}>{children}</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: StyleSheet.hairlineWidth,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
		paddingHorizontal: Spacing.three,
		paddingTop: Spacing.three,
		paddingBottom: Spacing.two,
	},
	title: {
		flex: 1,
		fontSize: 15,
	},
	titleSlot: {
		flex: 1,
	},
	body: {
		paddingHorizontal: Spacing.three,
		paddingBottom: Spacing.two,
	},
});
