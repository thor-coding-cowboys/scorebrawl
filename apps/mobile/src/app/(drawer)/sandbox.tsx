import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withRepeat,
	withTiming,
	Easing,
	type SharedValue,
} from "react-native-reanimated";

import { Avatar } from "@/components/avatar";
import { StreakAvatar } from "@/components/streak-avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";

const PARTICLE_COUNT = 35;
const ANIMATION_DURATION = 1600;
const AVATAR_SIZE = 120;

type Version = "border" | "fire-v1";

const VERSIONS: { key: Version; label: string }[] = [
	{ key: "border", label: "Border" },
	{ key: "fire-v1", label: "Fire V1" },
];

function FireParticle({ index, progress }: { index: number; progress: SharedValue<number> }) {
	const randomXSeed = Math.sin(index * 233.1) * (AVATAR_SIZE * 0.4);
	const sizeSeed = 15 + Math.abs(Math.cos(index * 721.4)) * 25;
	const spawnDelay = index / PARTICLE_COUNT;

	const animatedStyle = useAnimatedStyle(() => {
		const p = (progress.value + spawnDelay) % 1;

		const translateY = -p * (AVATAR_SIZE * 1.3);
		const translateX = Math.sin(p * 6 + index) * randomXSeed;
		const scale = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
		const dynamicSize = sizeSeed * scale;

		const color =
			p < 0.25 ? "rgb(255, 220, 90)" : p < 0.65 ? "rgb(255, 110, 0)" : "rgb(255, 69, 0)";

		return {
			transform: [{ translateX }, { translateY }],
			width: dynamicSize,
			height: dynamicSize,
			borderRadius: dynamicSize / 2,
			backgroundColor: color,
			opacity: 1 - p,
		};
	});

	return <Animated.View style={[styles.particle, animatedStyle]} />;
}

function FireAvatar() {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withRepeat(
			withTiming(1, { duration: ANIMATION_DURATION, easing: Easing.linear }),
			-1,
			false
		);
	}, [progress]);

	return (
		<View style={styles.fireWrapper}>
			<View style={styles.fireLayer}>
				{Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
					key: `fire-${i}`,
					index: i,
				})).map((p) => (
					<FireParticle key={p.key} index={p.index} progress={progress} />
				))}
			</View>
			<View style={styles.avatarRim}>
				<Avatar name="Test Player" size={AVATAR_SIZE} />
			</View>
		</View>
	);
}

export default function SandboxScreen() {
	const [version, setVersion] = useState<Version>("fire-v1");
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
						<FireAvatar />
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
		bottom: AVATAR_SIZE * 0.1,
	},
	fireWrapper: {
		position: "relative",
		width: AVATAR_SIZE,
		height: AVATAR_SIZE,
		justifyContent: "center",
		alignItems: "center",
	},
	fireLayer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 1,
		shadowColor: "#ff4500",
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.8,
		shadowRadius: 30,
		elevation: 20,
	},
	avatarRim: {
		zIndex: 2,
		borderRadius: AVATAR_SIZE * 0.2,
		borderWidth: 3,
		borderColor: "#ff6a00",
		overflow: "hidden",
	},
});
