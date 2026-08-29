import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";

import { Avatar } from "@/components/avatar";
import { AUTH_BASE_URL, authClient } from "@/lib/auth-client";

export function AppHeaderLeft() {
	const navigation = useNavigation<{ openDrawer: () => void }>();
	const { data } = authClient.useSession();
	const user = data?.user;
	const [cookie, setCookie] = useState<string>();

	useEffect(() => {
		let active = true;
		authClient.getCookie().then((value) => {
			if (active) setCookie(value);
		});
		return () => {
			active = false;
		};
	}, []);

	const imageUri = user?.image?.startsWith("http")
		? user.image
		: user?.image
			? `${AUTH_BASE_URL}/api/user-assets/${encodeURIComponent(user.image)}`
			: undefined;

	return (
		<Pressable
			onPress={() => navigation.openDrawer()}
			hitSlop={8}
			accessibilityRole="button"
			accessibilityLabel="Open league menu"
		>
			<Avatar
				name={user?.name ?? ""}
				image={imageUri}
				headers={cookie ? { cookie } : undefined}
				size={32}
			/>
		</Pressable>
	);
}
