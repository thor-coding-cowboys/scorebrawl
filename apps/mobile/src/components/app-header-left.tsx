import { useNavigation } from "expo-router";
import { Pressable } from "react-native";

import { Avatar } from "@/components/avatar";
import { authClient } from "@/lib/auth-client";

export function AppHeaderLeft() {
	const navigation = useNavigation();
	const { data } = authClient.useSession();
	const user = data?.user;

	const handlePress = () => {
		const drawerNav = navigation as unknown as { openDrawer?: () => void };
		drawerNav.openDrawer?.();
	};

	return (
		<Pressable onPress={handlePress} hitSlop={8} accessibilityLabel="Open league menu">
			<Avatar name={user?.name ?? ""} image={user?.image} size={32} />
		</Pressable>
	);
}
