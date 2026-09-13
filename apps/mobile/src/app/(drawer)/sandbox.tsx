import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StreakAvatar } from "@/components/streak-avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";

const PRESETS = [
	{ label: "Fire (7)", value: 7 },
	{ label: "Ice (-7)", value: -7 },
	{ label: "None (0)", value: 0 },
];

export default function SandboxScreen() {
	const [streak, setStreak] = useState(7);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Streak Effects
				</ThemedText>

				<View style={styles.controls}>
					<Button variant="outline" size="sm" onPress={() => setStreak((s) => s - 1)}>
						−1
					</Button>
					<Button variant="outline" size="sm" onPress={() => setStreak((s) => s + 1)}>
						+1
					</Button>
					{PRESETS.map((p) => (
						<Button
							key={p.label}
							variant={streak === p.value ? "primary" : "outline"}
							size="sm"
							onPress={() => setStreak(p.value)}
						>
							{p.label}
						</Button>
					))}
				</View>

				<ThemedText type="small" themeColor="textSecondary">
					Streak: {streak}
				</ThemedText>

				<View style={styles.hero}>
					<StreakAvatar name="Test Player" streak={streak} size={130} />
				</View>

				<View style={styles.sizes}>
					{[36, 56, 80].map((size) => (
						<View key={size} style={styles.sizeItem}>
							<StreakAvatar name="Test Player" streak={streak} size={size} />
							<ThemedText type="small" themeColor="textSecondary">
								{size}
							</ThemedText>
						</View>
					))}
				</View>

				<View style={styles.comparison}>
					{[7, 0, -7].map((s) => (
						<View key={s} style={styles.sizeItem}>
							<StreakAvatar name="Test Player" streak={s} size={36} />
							<ThemedText type="small" themeColor="textSecondary">
								{s > 0 ? `+${s}` : s}
							</ThemedText>
						</View>
					))}
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
	controls: {
		flexDirection: "row",
		gap: Spacing.two,
		marginBottom: Spacing.three,
		flexWrap: "wrap",
	},
	hero: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 100,
	},
	sizes: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "center",
		gap: 56,
		paddingVertical: 40,
	},
	comparison: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 40,
		paddingVertical: 32,
	},
	sizeItem: {
		alignItems: "center",
		gap: Spacing.two,
	},
});
