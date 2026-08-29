import { router } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedIcon } from "@/components/animated-icon";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { authClient } from "@/lib/auth-client";

export default function HomeScreen() {
	const { data } = authClient.useSession();
	const user = data?.user;

	const handleSignOut = async () => {
		await authClient.signOut();
		router.replace("/sign-in");
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<ThemedView style={styles.heroSection}>
					<AnimatedIcon />
					<ThemedText type="title" style={styles.title}>
						Scorebrawl
					</ThemedText>
					<ThemedText type="subtitle" style={styles.subtitle}>
						{user?.name ? `Welcome, ${user.name}` : "Signed in"}
					</ThemedText>
					<ThemedText type="small" style={styles.email}>
						{user?.email}
					</ThemedText>
				</ThemedView>

				<Button variant="outline" fullWidth onPress={handleSignOut}>
					Sign out
				</Button>
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
	},
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.four,
		paddingBottom: BottomTabInset + Spacing.three,
		justifyContent: "center",
		gap: Spacing.four,
	},
	heroSection: {
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.three,
		flex: 1,
	},
	title: {
		textAlign: "center",
	},
	subtitle: {
		textAlign: "center",
	},
	email: {
		textAlign: "center",
		opacity: 0.7,
	},
});
