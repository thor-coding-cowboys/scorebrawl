import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StreakAvatar } from "@/components/streak-avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";

export default function SandboxScreen() {
	const [streak, setStreak] = useState(0);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Sandbox
				</ThemedText>
				<View style={styles.body}>
					<StreakAvatar name="Test Player" streak={streak} />
					<ThemedText type="small" themeColor="textSecondary">
						Streak: {streak}
					</ThemedText>
					<View style={styles.controls}>
						<Button variant="outline" size="sm" onPress={() => setStreak((s) => s - 1)}>
							−1
						</Button>
						<Button variant="outline" size="sm" onPress={() => setStreak((s) => s + 1)}>
							+1
						</Button>
					</View>
					<View style={styles.controls}>
						<Button variant="outline" size="sm" onPress={() => setStreak(6)}>
							Fire (6)
						</Button>
						<Button variant="outline" size="sm" onPress={() => setStreak(-6)}>
							Ice (-6)
						</Button>
					</View>
				</View>
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
		paddingBottom: Spacing.three,
	},
	title: {
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
	body: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.four,
	},
	controls: {
		flexDirection: "row",
		gap: Spacing.two,
	},
});
