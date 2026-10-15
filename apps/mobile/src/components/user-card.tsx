import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { Avatar } from "@/components/avatar";
import {
	AnimatedCollapse,
	useCollapseProgress,
	useRotation,
} from "@/components/ui/animated-collapse";
import { ThemedText } from "@/components/themed-text";
import { Spacing, SharedColors } from "@/constants/theme";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { signOut as performSignOut } from "@/lib/sign-out";

function themeIconName(mode: "light" | "dark" | "system") {
	if (mode === "light")
		return { ios: "sun.max", android: "light_mode", web: "light_mode" } as const;
	if (mode === "dark") return { ios: "moon", android: "dark_mode", web: "dark_mode" } as const;
	return { ios: "display", android: "computer", web: "computer" } as const;
}

function themeLabel(mode: "light" | "dark" | "system") {
	if (mode === "light") return "Light mode";
	if (mode === "dark") return "Dark mode";
	return "System mode";
}

export function UserCard() {
	const theme = useTheme();
	const { themeMode, cycleThemeMode } = useThemeMode();
	const { data } = authClient.useSession();
	const user = data?.user;
	const { uri, headers } = useUserAvatar(user?.image);
	const [expanded, setExpanded] = useState(false);
	const progress = useCollapseProgress(expanded);
	const chevronStyle = useRotation(progress, 180);
	const queryClient = useQueryClient();

	const handleSignOut = async () => {
		await performSignOut();
		queryClient.clear();
		router.replace("/sign-in");
	};

	return (
		<View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="User menu"
				onPress={() => setExpanded((value) => !value)}
				style={({ pressed }) => [styles.userCard, pressed && { opacity: 0.7 }]}
			>
				<Avatar name={user?.name ?? ""} image={uri} headers={headers} size={40} />
				<View style={styles.userInfo}>
					<ThemedText type="smallBold" numberOfLines={1}>
						{user?.name}
					</ThemedText>
					<ThemedText type="small" themeColor="mutedForeground" numberOfLines={1}>
						{user?.email}
					</ThemedText>
				</View>
				<Animated.View style={chevronStyle}>
					<SymbolView
						name={{ ios: "chevron.up", android: "expand_less", web: "expand_less" }}
						size={16}
						tintColor={theme.mutedForeground}
					/>
				</Animated.View>
			</Pressable>

			<AnimatedCollapse expanded={expanded} progress={progress} style={styles.actions}>
				<Pressable
					accessibilityRole="button"
					onPress={() => {
						setExpanded(false);
						router.push("/profile");
					}}
					style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
				>
					<SymbolView
						name={{ ios: "person.crop.circle", android: "person", web: "person" }}
						size={18}
						tintColor={theme.foreground}
					/>
					<ThemedText type="small">Profile</ThemedText>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					onPress={cycleThemeMode}
					style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
				>
					<SymbolView name={themeIconName(themeMode)} size={18} tintColor={theme.foreground} />
					<ThemedText type="small">{themeLabel(themeMode)}</ThemedText>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					onPress={handleSignOut}
					style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
				>
					<SymbolView
						name={{ ios: "rectangle.portrait.and.arrow.right", android: "logout", web: "logout" }}
						size={18}
						tintColor={theme.destructive}
					/>
					<ThemedText type="small" style={{ color: theme.destructive }}>
						Log out
					</ThemedText>
				</Pressable>
			</AnimatedCollapse>
		</View>
	);
}

const styles = StyleSheet.create({
	userCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 0,
	},
	userInfo: {
		flex: 1,
	},
	actions: {
		marginTop: Spacing.two,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: SharedColors.dividerBorder,
		paddingTop: Spacing.two,
	},
	actionRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 0,
	},
});
