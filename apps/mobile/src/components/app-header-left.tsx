import { useNavigation } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { Avatar } from "@/components/avatar";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { authClient } from "@/lib/auth-client";

export function AppHeaderLeft() {
	const navigation = useNavigation<{ openDrawer: () => void }>();
	const { data } = authClient.useSession();
	const user = data?.user;
	const { uri, headers } = useUserAvatar(user?.image);

	return (
		<Pressable
			onPress={() => navigation.openDrawer()}
			hitSlop={8}
			accessibilityRole="button"
			accessibilityLabel="Open league menu"
			style={styles.button}
		>
			<Avatar name={user?.name ?? ""} image={uri} headers={headers} size={32} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		marginLeft: 16,
	},
});
