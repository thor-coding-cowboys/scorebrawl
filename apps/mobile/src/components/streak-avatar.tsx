import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { Canvas, Circle, Group, RadialGradient } from "@shopify/react-native-skia";

import { Avatar } from "@/components/avatar";

type StreakType = "fire" | "ice" | "none";

const FIRE_COLORS = ["#ffd700", "#ff8c00", "#ff4500", "#ffcc00"];
const ICE_COLORS = ["#e0f7ff", "#7dd3fc", "#38bdf8", "#a5f3fc"];

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

function useSpin(duration: number, reverse = false) {
	const progress = useSharedValue(0);
	useEffect(() => {
		progress.value = withRepeat(withTiming(1, { duration }), -1, false);
	}, [duration, progress]);
	return useDerivedValue(() => (reverse ? -progress.value * 360 : progress.value * 360));
}

function usePulse(duration: number) {
	const pulse = useSharedValue(0);
	useEffect(() => {
		pulse.value = withRepeat(withTiming(1, { duration }), -1, true);
	}, [duration, pulse]);
	return pulse;
}

function FireEffect() {
	const pulse = usePulse(1600);
	const rotation = useSpin(4000);

	const ringRotation = useDerivedValue(() => [{ rotate: rotation.value }]);

	const sparks = useMemo(() => {
		return Array.from({ length: 14 }, (_, i) => {
			const angle = (i / 14) * Math.PI * 2;
			return {
				angle,
				radius: 17 + (i % 3) * 2,
				length: i % 4 === 0 ? 7 : 3,
				color: FIRE_COLORS[i % FIRE_COLORS.length],
			};
		});
	}, []);

	return (
		<>
			<Canvas style={styles.canvas}>
				<Group>
					<Circle cx={22} cy={22} r={21}>
						<RadialGradient
							c={{ x: 22, y: 22 }}
							r={21}
							colors={["rgba(255,120,0,0.55)", "rgba(255,60,0,0.18)", "rgba(255,60,0,0)"]}
						/>
					</Circle>
				</Group>

				<Group transform={ringRotation}>
					{sparks.map((spark) => (
						<Group
							key={spark.angle}
							transform={[
								{ translateX: 22 + spark.radius * Math.cos(spark.angle) },
								{ translateY: 22 + spark.radius * Math.sin(spark.angle) },
								{ rotate: spark.angle + Math.PI / 2 },
							]}
						>
							<Circle cx={0} cy={0} r={spark.length * 0.5} color={spark.color} opacity={0.9} />
						</Group>
					))}
				</Group>

				<Circle cx={22} cy={38} r={2.5} color="#ff8c00" opacity={0.6} />
				<Circle cx={14} cy={37} r={2} color="#ffd700" opacity={0.5} />
				<Circle cx={30} cy={37} r={2} color="#ff4500" opacity={0.5} />
			</Canvas>
			<Animated.View
				style={[
					styles.pulseRing,
					{
						borderColor: "#f97316",
						shadowColor: "#f97316",
					},
					useAnimatedStyle(() => ({
						opacity: 0.5 + pulse.value * 0.5,
						transform: [{ scale: 1 + pulse.value * 0.06 }],
					})),
				]}
			/>
		</>
	);
}

function IceEffect() {
	const pulse = usePulse(1800);
	const rotation = useSpin(5200, true);

	const ringRotation = useDerivedValue(() => [{ rotate: rotation.value }]);

	const shards = useMemo(() => {
		return Array.from({ length: 16 }, (_, i) => {
			const angle = (i / 16) * Math.PI * 2;
			return {
				angle,
				radius: 18,
				height: i % 3 === 0 ? 9 : 5,
				color: ICE_COLORS[i % ICE_COLORS.length],
			};
		});
	}, []);

	return (
		<>
			<Canvas style={styles.canvas}>
				<Group>
					<Circle cx={22} cy={22} r={21}>
						<RadialGradient
							c={{ x: 22, y: 22 }}
							r={21}
							colors={["rgba(125,211,252,0.5)", "rgba(56,189,248,0.16)", "rgba(56,189,248,0)"]}
						/>
					</Circle>
				</Group>

				<Group transform={ringRotation}>
					{shards.map((shard) => (
						<Group
							key={shard.angle}
							transform={[
								{ translateX: 22 + shard.radius * Math.cos(shard.angle) },
								{ translateY: 22 + shard.radius * Math.sin(shard.angle) },
								{ rotate: shard.angle + Math.PI / 2 },
							]}
						>
							<Circle cx={0} cy={0} r={shard.height * 0.22} color={shard.color} opacity={0.85} />
							<Circle
								cx={0}
								cy={shard.height * 0.5}
								r={shard.height * 0.14}
								color={shard.color}
								opacity={0.5}
							/>
						</Group>
					))}
				</Group>

				<Circle cx={22} cy={6} r={2} color="#bae6fd" opacity={0.7} />
				<Circle cx={15} cy={8} r={1.5} color="#7dd3fc" opacity={0.6} />
				<Circle cx={29} cy={7} r={1.8} color="#a5f3fc" opacity={0.6} />
			</Canvas>
			<Animated.View
				style={[
					styles.pulseRing,
					{
						borderColor: "#38bdf8",
						shadowColor: "#38bdf8",
					},
					useAnimatedStyle(() => ({
						opacity: 0.5 + pulse.value * 0.5,
						transform: [{ scale: 1 + pulse.value * 0.06 }],
					})),
				]}
			/>
		</>
	);
}

export function StreakAvatar({ name, image, headers, streak }: StreakAvatarProps) {
	const type = getStreakType(streak);

	return (
		<View style={styles.wrap}>
			{type === "fire" ? <FireEffect /> : type === "ice" ? <IceEffect /> : null}
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
	canvas: {
		position: "absolute",
		top: 0,
		left: 0,
		width: 44,
		height: 44,
	},
	pulseRing: {
		position: "absolute",
		width: 40,
		height: 40,
		borderRadius: 12,
		borderWidth: 1.5,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.5,
		shadowRadius: 6,
	},
});
