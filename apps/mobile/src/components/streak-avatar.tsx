import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

import { Avatar } from "@/components/avatar";

type StreakType = "fire" | "ice" | "none";

const FIRE_COLORS = ["#ff4500", "#ff8c00", "#ffcc00", "#ff6a00"];
const ICE_COLORS = ["#87ceeb", "#00bfff", "#e0f7ff", "#b0e0ff"];

function getStreakType(streak: number): StreakType {
	if (streak >= 5) return "fire";
	if (streak <= -5) return "ice";
	return "none";
}

interface StreakAvatarProps {
	name: string;
	image?: string | null;
	headers?: Record<string, string>;
	streak: number;
}

function OrbitRing({ type }: { type: "fire" | "ice" }) {
	const rotation = useSharedValue(0);
	const colors = type === "fire" ? FIRE_COLORS : ICE_COLORS;

	useEffect(() => {
		rotation.value = withRepeat(withTiming(360, { duration: 6000 }), -1, false);
	}, [rotation]);

	const ringStyle = useAnimatedStyle(() => ({
		transform: [{ rotateZ: `${rotation.value}deg` }],
	}));

	const particles = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);

return (
			<Animated.View style={[styles.orbit, ringStyle]} pointerEvents="none">
				{particles.map((angle, i) => {
					const rad = (angle * Math.PI) / 180;
					const radius = 20;
					const x = radius * Math.cos(rad);
					const y = radius * Math.sin(rad);
					const isStreak = i % 3 === 0;
					return (
						<View
							key={angle}
							style={[
							styles.particle,
							isStreak ? styles.comet : styles.spark,
							{
								backgroundColor: colors[i % colors.length],
								transform: [{ translateX: x }, { translateY: y }],
							},
						]}
					/>
				);
			})}
		</Animated.View>
	);
}

function PulseGlow({ type }: { type: "fire" | "ice" }) {
	const pulse = useSharedValue(0);
	const color = type === "fire" ? "#f97316" : "#38bdf8";

	useEffect(() => {
		pulse.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
	}, [pulse]);

	const glowStyle = useAnimatedStyle(() => ({
		opacity: 0.25 + pulse.value * 0.35,
		transform: [{ scale: 1 + pulse.value * 0.08 }],
	}));

	const ringStyle = useAnimatedStyle(() => ({
		opacity: 0.5 + pulse.value * 0.5,
		transform: [{ scale: 1 + pulse.value * 0.05 }],
	}));

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none">
			<Animated.View
				style={[
					styles.glow,
					{
						backgroundColor: color,
						shadowColor: color,
					},
					glowStyle,
				]}
			/>
			<Animated.View style={[styles.ring, { borderColor: color }, ringStyle]} />
		</View>
	);
}

function Twinkle({ type, index, color }: { type: "fire" | "ice"; index: number; color: string }) {
	const opacity = useSharedValue(0);

	useEffect(() => {
		opacity.value = withRepeat(withDelay(index * 180, withTiming(1, { duration: 600 })), -1, true);
	}, [opacity, index]);

	const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

	const sparkle = type === "fire" ? styles.fireSparkle : styles.iceSparkle;

	return (
		<View
			pointerEvents="none"
			style={[
				styles.twinkle,
				{
					top: index % 2 === 0 ? -6 : -3,
					left: index % 3 === 0 ? -3 : -5,
				},
			]}
		>
			<Animated.View style={[sparkle, { backgroundColor: color }, style]} />
		</View>
	);
}

export function StreakAvatar({ name, image, headers, streak }: StreakAvatarProps) {
	const type = getStreakType(streak);

	if (type === "none") {
		return (
			<View style={styles.wrap}>
				<Avatar name={name} image={image} headers={headers} size={36} />
			</View>
		);
	}

	return (
		<View style={styles.wrap}>
			<PulseGlow type={type} />
			<OrbitRing type={type} />
			{Array.from({ length: 4 }, (_, i) => (
				<Twinkle
					key={i}
					type={type}
					index={i}
					color={
						type === "fire"
							? FIRE_COLORS[i % FIRE_COLORS.length]
							: ICE_COLORS[i % ICE_COLORS.length]
					}
				/>
			))}
			<View style={styles.avatarInner}>
				<Avatar name={name} image={image} headers={headers} size={36} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarInner: {
		zIndex: 2,
	},
	glow: {
		position: "absolute",
		width: 44,
		height: 44,
		borderRadius: 12,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.6,
		shadowRadius: 8,
	},
	ring: {
		position: "absolute",
		width: 42,
		height: 42,
		borderRadius: 12,
		borderWidth: 2,
	},
	orbit: {
		position: "absolute",
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 1,
	},
	particle: {
		position: "absolute",
		left: 21,
		top: 21,
	},
	spark: {
		width: 4,
		height: 4,
		borderRadius: 2,
		opacity: 0.9,
	},
	comet: {
		width: 8,
		height: 3,
		borderRadius: 2,
		opacity: 0.95,
	},
	twinkle: {
		position: "absolute",
		zIndex: 3,
	},
	fireSparkle: {
		width: 3,
		height: 3,
		borderRadius: 2,
	},
	iceSparkle: {
		width: 2,
		height: 6,
		borderRadius: 1,
	},
});
