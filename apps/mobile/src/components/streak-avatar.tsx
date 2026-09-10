import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { Canvas, Circle, RadialGradient } from "@shopify/react-native-skia";

import { Avatar } from "@/components/avatar";

type StreakType = "fire" | "ice" | "none";

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

const FIRE_GLOW = ["rgba(255,140,0,0.6)", "rgba(255,60,0,0.2)", "rgba(255,60,0,0)"];
const ICE_GLOW = ["rgba(125,211,252,0.55)", "rgba(56,189,248,0.18)", "rgba(56,189,248,0)"];

function useClock() {
	const clock = useSharedValue(0);
	useFrameCallback((info) => {
		clock.value = info.timeSinceFirstFrame;
	});
	return clock;
}

function FireEffect() {
	const clock = useClock();

	const embers = useMemo(() => {
		return Array.from({ length: 18 }, (_, i) => ({
			x: 6 + (i % 6) * 6.4,
			speed: 0.06 + (i % 5) * 0.02,
			phase: (i / 18) * 2 * Math.PI,
			sway: 1.5 + (i % 3),
			size: 1.6 + (i % 4) * 0.7,
			colors: ["#ffd700", "#ff8c00", "#ff4500", "#ffb300"],
		}));
	}, []);

	return (
		<Canvas style={styles.canvas}>
			<Circle cx={22} cy={22} r={21}>
				<RadialGradient c={{ x: 22, y: 22 }} r={21} colors={FIRE_GLOW} />
			</Circle>

			{embers.map((ember, i) => {
				const rise = useDerivedValue(() => {
					const t = (clock.value * ember.speed + ember.phase) % (2 * Math.PI);
					return (Math.sin(t) + 1) / 2;
				});
				const cy = useDerivedValue(() => 36 - rise.value * 30);
				const cx = useDerivedValue(
					() => 22 + Math.sin(clock.value * 0.004 + ember.phase) * ember.sway
				);
				const opacity = useDerivedValue(() => rise.value * 0.9);
				const size = useDerivedValue(() => ember.size * (0.4 + rise.value * 0.6));

				return (
					<Circle
						key={ember.phase}
						cx={cx}
						cy={cy}
						r={size}
						color={ember.colors[i % ember.colors.length]}
						opacity={opacity}
					/>
				);
			})}

			<Circle cx={22} cy={22} r={18}>
				<RadialGradient
					c={{ x: 22, y: 22 }}
					r={18}
					colors={["rgba(255,200,100,0.12)", "rgba(255,100,0,0.06)", "rgba(255,100,0,0)"]}
				/>
			</Circle>
		</Canvas>
	);
}

function IceEffect() {
	const clock = useClock();

	const crystals = useMemo(() => {
		return Array.from({ length: 16 }, (_, i) => ({
			x: 6 + (i % 5) * 7.5,
			speed: 0.05 + (i % 4) * 0.018,
			phase: (i / 16) * 2 * Math.PI,
			drift: 1.5 + (i % 3),
			size: 1.4 + (i % 4) * 0.6,
			colors: ["#e0f7ff", "#7dd3fc", "#38bdf8", "#a5f3fc"],
		}));
	}, []);

	return (
		<Canvas style={styles.canvas}>
			<Circle cx={22} cy={22} r={21}>
				<RadialGradient c={{ x: 22, y: 22 }} r={21} colors={ICE_GLOW} />
			</Circle>

			{crystals.map((crystal, i) => {
				const fall = useDerivedValue(() => {
					const t = (clock.value * crystal.speed + crystal.phase) % (2 * Math.PI);
					return (Math.sin(t) + 1) / 2;
				});
				const cy = useDerivedValue(() => 8 + fall.value * 30);
				const cx = useDerivedValue(
					() => 22 + Math.sin(clock.value * 0.0035 + crystal.phase * 2) * crystal.drift
				);
				const opacity = useDerivedValue(() => 0.3 + fall.value * 0.7);
				const size = useDerivedValue(() => crystal.size * (1 - fall.value * 0.4));

				return (
					<Circle
						key={crystal.phase}
						cx={cx}
						cy={cy}
						r={size}
						color={crystal.colors[i % crystal.colors.length]}
						opacity={opacity}
					/>
				);
			})}

			<Circle cx={22} cy={22} r={18}>
				<RadialGradient
					c={{ x: 22, y: 22 }}
					r={18}
					colors={["rgba(190,230,255,0.12)", "rgba(120,190,255,0.06)", "rgba(120,190,255,0)"]}
				/>
			</Circle>
		</Canvas>
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
});
