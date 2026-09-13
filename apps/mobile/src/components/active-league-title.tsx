import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { DEFAULT_LEAGUE_LOGO } from "@/lib/league";

export function ActiveLeagueTitle() {
	const { activeLeague } = useActiveLeague();
	const { uri, headers } = useUserAvatar(activeLeague?.logo || DEFAULT_LEAGUE_LOGO);

	return (
		<View style={styles.container}>
			{activeLeague && <Avatar name={activeLeague.name} image={uri} headers={headers} size={28} />}
			<ThemedText type="subtitle" numberOfLines={1} style={styles.title}>
				{activeLeague?.name ?? ""}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	title: {
		fontSize: 18,
		lineHeight: 24,
	},
});
