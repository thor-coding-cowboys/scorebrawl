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

type ButtonVariant = "primary" | "outline" | "glow";
type ButtonSize = "default" | "sm";

interface ButtonProps extends PressableProps {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	fullWidth?: boolean;
	style?: StyleProp<ViewStyle>;
	children: React.ReactNode;
}

export function Button({
	variant = "primary",
	size = "default",
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
	const isGlow = variant === "glow";
	const backgroundColor = isPrimary
		? theme.buttonPrimary
		: isGlow
			? theme.glowBlueBg
			: pressed
				? theme.backgroundSelected
				: "transparent";
	const borderStyle: ViewStyle = isPrimary
		? {}
		: isGlow
			? { borderWidth: 1, borderColor: theme.glowBlueBorder }
			: { borderWidth: 1, borderColor: theme.border };
	const textColor = isPrimary ? theme.primaryForeground : isGlow ? theme.glowBlueText : theme.text;

	return (
		<Pressable
			disabled={disabled || loading}
			onPressIn={() => setPressed(true)}
			onPressOut={() => setPressed(false)}
			style={[
				styles.button,
				size === "sm" && styles.buttonSm,
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
				<Text style={[styles.label, size === "sm" && styles.labelSm, { color: textColor }]}>
					{children}
				</Text>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		height: 44,
		borderRadius: 0,
		paddingHorizontal: Spacing.four,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: Spacing.two,
	},
	buttonSm: {
		height: 32,
		paddingHorizontal: Spacing.three,
	},
	fullWidth: {
		width: "100%",
	},
	label: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	labelSm: {
		fontSize: 13,
		lineHeight: 18,
	},
});
