import type { DrawerNavigationProp } from "expo-router/drawer";
import { useNavigation } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type SymbolName = Parameters<typeof SymbolView>[0]["name"];

export function HeaderMenuButton() {
	const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
	return (
		<HeaderIconButton
			icon={{ ios: "sidebar.left", android: "menu", web: "menu" }}
			label="Open menu"
			onPress={() => navigation.openDrawer()}
		/>
	);
}

export function HeaderIconButton({
	icon,
	label,
	onPress,
	tint,
}: {
	icon: SymbolName;
	label: string;
	onPress: () => void;
	tint?: string;
}) {
	const theme = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			hitSlop={8}
			style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
		>
			<SymbolView name={icon} size={20} tintColor={tint ?? theme.foreground} />
		</Pressable>
	);
}

export function HeaderPillButton({
	icon,
	label,
	onPress,
	tone = "default",
	disabled,
}: {
	icon?: SymbolName;
	label: string;
	onPress: () => void;
	tone?: "default" | "glow" | "destructive";
	disabled?: boolean;
}) {
	const theme = useTheme();
	const color =
		tone === "glow"
			? theme.glowBlueText
			: tone === "destructive"
				? theme.destructive
				: theme.foreground;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			disabled={disabled}
			hitSlop={6}
			style={({ pressed }) => [styles.pill, (pressed || disabled) && styles.pressed]}
		>
			{icon ? <SymbolView name={icon} size={14} weight="semibold" tintColor={color} /> : null}
			<ThemedText type="smallBold" style={[styles.pillLabel, { color }]}>
				{label}
			</ThemedText>
		</Pressable>
	);
}

export function HeaderActions({ children }: { children: ReactNode }) {
	return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
	icon: {
		width: 36,
		height: 36,
		alignItems: "center",
		justifyContent: "center",
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		height: 36,
		paddingHorizontal: 8,
	},
	pillLabel: {
		fontSize: 14,
		lineHeight: 18,
	},
	pressed: {
		opacity: 0.6,
	},
	actions: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
});
