import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { authClient } from "@/lib/auth-client";

export default function ProfileScreen() {
	const { data } = authClient.useSession();
	const user = data?.user;
	const { uri, headers } = useUserAvatar(user?.image);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				<View style={styles.header}>
					<Avatar name={user?.name ?? ""} image={uri} headers={headers} size={64} />
					<ThemedText type="title">{user?.name}</ThemedText>
					<ThemedText type="small" themeColor="textSecondary">
						{user?.email}
					</ThemedText>
				</View>
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	safeArea: {
		flex: 1,
		alignItems: "center",
		paddingTop: Spacing.six,
	},
	header: {
		alignItems: "center",
		gap: Spacing.two,
	},
});
