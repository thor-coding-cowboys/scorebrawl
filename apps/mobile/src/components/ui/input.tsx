import { useState } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface InputProps extends TextInputProps {
	label: string;
	error?: string;
}

export function Input({ label, error, style, onFocus, onBlur, ...props }: InputProps) {
	const theme = useTheme();
	const [focused, setFocused] = useState(false);

	return (
		<View style={styles.container}>
			<Text style={[styles.label, { color: theme.text }]}>{label}</Text>
			<TextInput
				placeholderTextColor={theme.mutedForeground}
				onFocus={(e) => {
					setFocused(true);
					onFocus?.(e);
				}}
				onBlur={(e) => {
					setFocused(false);
					onBlur?.(e);
				}}
				style={[
					styles.input,
					{
						backgroundColor: theme.background,
						borderColor: error ? theme.destructive : focused ? theme.primary : theme.border,
						color: theme.text,
					},
					style,
				]}
				{...props}
			/>
			{error ? <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		gap: Spacing.two,
	},
	label: {
		fontSize: 14,
		fontWeight: "600",
		lineHeight: 20,
	},
	input: {
		height: 44,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: Spacing.three,
		fontSize: 16,
		lineHeight: 24,
	},
	error: {
		fontSize: 13,
		lineHeight: 18,
	},
});
