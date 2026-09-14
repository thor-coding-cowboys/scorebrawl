import { SymbolView } from "expo-symbols";
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

import { Fonts } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type ButtonVariant = "primary" | "outline" | "glow" | "ghost";
type ButtonSize = "default" | "sm" | "lg" | "icon" | "iconSm";

const ICON_SIZE: Record<ButtonSize, number> = {
	default: 16,
	sm: 14,
	lg: 16,
	icon: 16,
	iconSm: 14,
};

interface ButtonProps extends PressableProps {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	fullWidth?: boolean;
	icon?: Parameters<typeof SymbolView>[0]["name"];
	style?: StyleProp<ViewStyle>;
	children?: React.ReactNode;
}

export function Button({
	variant = "primary",
	size = "default",
	loading = false,
	fullWidth = false,
	icon,
	disabled,
	style,
	children,
	...props
}: ButtonProps) {
	const theme = useTheme();
	const [pressed, setPressed] = useState(false);

	const isPrimary = variant === "primary";
	const isGlow = variant === "glow";
	const isGhost = variant === "ghost";
	const backgroundColor = isPrimary
		? theme.buttonPrimary
		: isGlow
			? theme.glowBlueBg
			: pressed
				? theme.backgroundSelected
				: "transparent";
	const borderStyle: ViewStyle =
		isPrimary || isGhost
			? {}
			: isGlow
				? { borderWidth: 1, borderColor: theme.glowBlueBorder }
				: { borderWidth: 1, borderColor: theme.border };
	const textColor = isPrimary
		? theme.primaryForeground
		: isGlow
			? theme.glowBlueText
			: isGhost
				? theme.textSecondary
				: theme.text;

	return (
		<Pressable
			disabled={disabled || loading}
			onPressIn={() => setPressed(true)}
			onPressOut={() => setPressed(false)}
			style={[
				styles.button,
				size === "sm" && styles.buttonSm,
				size === "lg" && styles.buttonLg,
				size === "icon" && styles.buttonIcon,
				size === "iconSm" && styles.buttonIconSm,
				borderStyle,
				{ backgroundColor, opacity: disabled || loading ? 0.5 : 1 },
				fullWidth && styles.fullWidth,
				style,
			]}
			{...props}
		>
			{loading ? (
				<ActivityIndicator color={textColor} size="small" />
			) : (
				<>
					{icon ? <SymbolView name={icon} size={ICON_SIZE[size]} tintColor={textColor} /> : null}
					{children !== undefined && children !== null ? (
						<Text style={[styles.label, { color: textColor }]}>{children}</Text>
					) : null}
				</>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		height: 32,
		borderRadius: 0,
		paddingHorizontal: 10,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: 6,
	},
	buttonSm: {
		height: 28,
		gap: 4,
	},
	buttonLg: {
		height: 36,
	},
	buttonIcon: {
		width: 32,
		height: 32,
		paddingHorizontal: 0,
	},
	buttonIconSm: {
		width: 28,
		height: 28,
		paddingHorizontal: 0,
	},
	fullWidth: {
		width: "100%",
	},
	label: {
		fontFamily: Fonts.sans,
		fontWeight: "400",
		fontSize: 12,
		lineHeight: 16,
	},
});
