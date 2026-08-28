import { StyleSheet, View, type ViewProps, Text, type TextProps } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Card({ style, ...props }: ViewProps) {
	const theme = useTheme();
	return (
		<View
			style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}
			{...props}
		/>
	);
}

export function CardHeader({ style, ...props }: ViewProps) {
	return <View style={[styles.header, style]} {...props} />;
}

export function CardTitle({ style, ...props }: TextProps) {
	const theme = useTheme();
	return <Text style={[styles.title, { color: theme.text }, style]} {...props} />;
}

export function CardDescription({ style, ...props }: TextProps) {
	const theme = useTheme();
	return <Text style={[styles.description, { color: theme.mutedForeground }, style]} {...props} />;
}

export function CardContent({ style, ...props }: ViewProps) {
	return <View style={[styles.content, style]} {...props} />;
}

const styles = StyleSheet.create({
	card: {
		width: "100%",
		borderWidth: 1,
		borderRadius: 10,
	},
	header: {
		gap: Spacing.two,
		padding: Spacing.four,
	},
	content: {
		paddingHorizontal: Spacing.four,
		paddingBottom: Spacing.four,
	},
	title: {
		fontSize: 24,
		lineHeight: 32,
		fontWeight: "700",
	},
	description: {
		fontSize: 14,
		lineHeight: 20,
	},
});
