import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type ButtonVariant = "primary" | "outline";

interface ButtonProps extends PressableProps {
	variant?: ButtonVariant;
	loading?: boolean;
	fullWidth?: boolean;
	style?: StyleProp<ViewStyle>;
	children: React.ReactNode;
}

export function Button({
	variant = "primary",
	loading = false,
	fullWidth = false,
	disabled,
	style,
	children,
	...props
}: ButtonProps) {
	const theme = useTheme();
	const [pressed, setPressed] = useState(false);

	const isPrimary = variant === "primary";
	const backgroundColor = isPrimary
		? theme.primary
		: pressed
			? theme.backgroundSelected
			: "transparent";
	const borderStyle: ViewStyle = isPrimary ? {} : { borderWidth: 1, borderColor: theme.border };
	const textColor = isPrimary ? theme.primaryForeground : theme.text;

	return (
		<Pressable
			disabled={disabled || loading}
			onPressIn={() => setPressed(true)}
			onPressOut={() => setPressed(false)}
			style={[
				styles.button,
				borderStyle,
				{ backgroundColor, opacity: disabled || loading ? 0.6 : 1 },
				fullWidth && styles.fullWidth,
				style,
			]}
			{...props}
		>
			{loading ? (
				<ActivityIndicator color={textColor} />
			) : (
				<Text style={[styles.label, { color: textColor }]}>{children}</Text>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		height: 44,
		borderRadius: 10,
		paddingHorizontal: Spacing.four,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: Spacing.two,
	},
	fullWidth: {
		width: "100%",
	},
	label: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
});
