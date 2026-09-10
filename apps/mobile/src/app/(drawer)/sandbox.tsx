import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withRepeat,
	withTiming,
	type SharedValue,
} from "react-native-reanimated";

import { StreakAvatar } from "@/components/streak-avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";

const PARTICLE_COUNT = 40;
const ANIMATION_DURATION = 1500;

type Version = "border" | "fire-v1";

const VERSIONS: { key: Version; label: string }[] = [
	{ key: "border", label: "Border" },
	{ key: "fire-v1", label: "Fire V1" },
];

function FireV1Particle({ index, progress }: { index: number; progress: SharedValue<number> }) {
	const randomXSeed = Math.sin(index * 452.3) * 40;
	const sizeSeed = 20 + Math.abs(Math.cos(index * 943.1)) * 30;
	const speedDelay = index / PARTICLE_COUNT;

	const animatedStyle = useAnimatedStyle(() => {
		const p = (progress.value + speedDelay) % 1;
		const translateY = -p * 220;
		const translateX = Math.sin(p * 5 + index) * randomXSeed;
		const scale = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
		const dynamicSize = sizeSeed * scale;
		const color = p < 0.2 ? "rgb(255, 230, 100)" : p < 0.6 ? "rgb(255, 120, 0)" : "rgb(255, 69, 0)";
		const opacity = 1 - p;

		return {
			transform: [{ translateX }, { translateY }],
			width: dynamicSize,
			height: dynamicSize,
			borderRadius: dynamicSize / 2,
			backgroundColor: color,
			opacity,
		};
	});

	return <Animated.View style={[styles.particle, animatedStyle]} />;
}

function FireV1Effect() {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withRepeat(withTiming(1, { duration: ANIMATION_DURATION }), -1, false);
	}, [progress]);

	const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
		key: `fire-${i}`,
		index: i,
	}));

	return (
		<View style={styles.fireBase}>
			{particles.map((p) => (
				<FireV1Particle key={p.key} index={p.index} progress={progress} />
			))}
		</View>
	);
}

export default function SandboxScreen() {
	const [version, setVersion] = useState<Version>("border");
	const [streak, setStreak] = useState(6);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Sandbox
				</ThemedText>

				<View style={styles.controls}>
					{VERSIONS.map((v) => (
						<Button
							key={v.key}
							variant={version === v.key ? "primary" : "outline"}
							size="sm"
							onPress={() => setVersion(v.key)}
						>
							{v.label}
						</Button>
					))}
				</View>

				<View style={styles.body}>
					{version === "border" ? (
						<>
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
						</>
					) : version === "fire-v1" ? (
						<FireV1Effect />
					) : null}
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
		marginBottom: Spacing.four,
		flexWrap: "wrap",
	},
	body: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.four,
	},
	particle: {
		position: "absolute",
		bottom: 0,
	},
	fireBase: {
		position: "relative",
		width: 60,
		height: 20,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: "#ff4500",
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.8,
		shadowRadius: 30,
		elevation: 20,
	},
});
