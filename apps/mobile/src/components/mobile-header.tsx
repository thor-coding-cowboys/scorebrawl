import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { DEFAULT_LEAGUE_LOGO } from "@/lib/league";

export function MobileHeader({
	title,
	eyebrow,
	onBack,
	right,
	showLeagueIcon = true,
}: {
	title: string;
	eyebrow?: string;
	onBack?: () => void;
	right?: ReactNode;
	showLeagueIcon?: boolean;
}) {
	const theme = useTheme();
	const { activeLeague } = useActiveLeague();
	const { uri, headers } = useUserAvatar(activeLeague?.logo || DEFAULT_LEAGUE_LOGO);

	return (
		<View style={styles.container}>
			{onBack ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Back"
					onPress={onBack}
					hitSlop={8}
					style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
				>
					<SymbolView
						name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
						size={18}
						tintColor={theme.text}
					/>
				</Pressable>
			) : null}
			{showLeagueIcon && activeLeague ? (
				<Avatar name={activeLeague.name} image={uri} headers={headers} size={22} borderRadius={6} />
			) : null}
			<View style={styles.text}>
				{eyebrow ? (
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						{eyebrow}
					</ThemedText>
				) : null}
				<ThemedText style={styles.title} numberOfLines={1}>
					{title}
				</ThemedText>
			</View>
			{right ?? null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		minHeight: 44,
		marginTop: Spacing.two,
		marginBottom: Spacing.two,
	},
	back: {
		paddingRight: Spacing.one,
	},
	text: {
		flex: 1,
		gap: 1,
	},
	title: {
		fontSize: 17,
		lineHeight: 22,
		fontWeight: "400",
	},
});
