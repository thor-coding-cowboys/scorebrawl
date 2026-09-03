import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";

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

	const handleSignOut = async () => {
		await authClient.signOut();
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
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						{user?.email}
					</ThemedText>
				</View>
				<SymbolView
					name={{
						ios: expanded ? "chevron.down" : "chevron.up",
						android: "expand_more",
						web: "expand_more",
					}}
					size={16}
					tintColor={theme.textSecondary}
				/>
			</Pressable>

			{expanded && (
				<View style={styles.actions}>
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
							tintColor={theme.text}
						/>
						<ThemedText type="small">Profile</ThemedText>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						onPress={cycleThemeMode}
						style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
					>
						<SymbolView name={themeIconName(themeMode)} size={18} tintColor={theme.text} />
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
				</View>
			)}
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
		borderRadius: 10,
	},
	userInfo: {
		flex: 1,
	},
	actions: {
		marginTop: Spacing.two,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "rgba(128,128,128,0.3)",
		paddingTop: Spacing.two,
	},
	actionRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 10,
	},
});
