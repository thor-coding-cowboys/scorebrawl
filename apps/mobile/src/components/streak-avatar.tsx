import {
	BlurMask,
	Canvas,
	Circle,
	Group,
	LinearGradient,
	Path,
	RadialGradient,
	Rect,
	RoundedRect,
	rect,
	rrect,
	vec,
} from "@shopify/react-native-skia";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import {
	Easing,
	type SharedValue,
	useDerivedValue,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

import { Avatar } from "@/components/avatar";

type StreakType = "fire" | "ice" | "none";

function getStreakType(streak: number): StreakType {
	if (streak >= 5) return "fire";
	if (streak <= -5) return "ice";
	return "none";
}

const TAU = Math.PI * 2;

const STROKE = { style: "stroke" } as const;
const BLUR_NORMAL = { style: "normal" } as const;

function useClock(duration: number) {
	const clock = useSharedValue(0);
	useEffect(() => {
		clock.value = 0;
		clock.value = withRepeat(withTiming(TAU, { duration, easing: Easing.linear }), -1, false);
	}, [clock, duration]);
	return clock;
}

interface Geometry {
	size: number;
	ext: number;
	canvas: number;
	c: number;
	r: number;
	radius: number;
}

function geometry(size: number): Geometry {
	const ext = size * 0.68;
	const canvas = size + ext * 2;
	return {
		size,
		ext,
		canvas,
		c: canvas / 2,
		r: size / 2,
		radius: Math.max(8, size * 0.22),
	};
}

function flamePath(bx: number, by: number, w: number, h: number) {
	return `M ${bx} ${by} C ${bx - w} ${by - h * 0.35} ${bx - w * 0.45} ${by - h * 0.8} ${bx} ${by - h} C ${bx + w * 0.45} ${by - h * 0.8} ${bx + w} ${by - h * 0.35} ${bx} ${by} Z`;
}

function shardPath(cx: number, cy: number, r: number, angleDeg: number, len: number, w: number) {
	const rad = (angleDeg * Math.PI) / 180;
	const ex = cx + r * Math.cos(rad);
	const ey = cy + r * Math.sin(rad);
	const tx = cx + (r + len) * Math.cos(rad);
	const ty = cy + (r + len) * Math.sin(rad);
	const px = -Math.sin(rad) * w;
	const py = Math.cos(rad) * w;
	return `M ${ex + px} ${ey + py} L ${tx} ${ty} L ${ex - px} ${ey - py} Z`;
}

function starPath(x: number, y: number, r: number) {
	const c = r * 0.22;
	return `M ${x} ${y - r} L ${x + c} ${y - c} L ${x + r} ${y} L ${x + c} ${y + c} L ${x} ${y + r} L ${x - c} ${y + c} L ${x - r} ${y} L ${x - c} ${y - c} Z`;
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
	const s = (startDeg * Math.PI) / 180;
	const e = ((startDeg + sweepDeg) * Math.PI) / 180;
	const large = sweepDeg > 180 ? 1 : 0;
	return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`;
}

const FLAMES = [
	{ angle: 0, h: 0.5, w: 0.8, phase: 1.3, speed: 3 },
	{ angle: -20, h: 0.58, w: 0.88, phase: 0.6, speed: 3 },
	{ angle: -42, h: 0.72, w: 0.98, phase: 1.8, speed: 2 },
	{ angle: -64, h: 0.84, w: 1.05, phase: 0.2, speed: 3 },
	{ angle: -82, h: 0.92, w: 1.12, phase: 2.4, speed: 2 },
	{ angle: -90, h: 0.94, w: 1.15, phase: 1.6, speed: 2 },
	{ angle: -98, h: 0.92, w: 1.12, phase: 1.1, speed: 3 },
	{ angle: -116, h: 0.84, w: 1.05, phase: 2.9, speed: 2 },
	{ angle: -138, h: 0.72, w: 0.98, phase: 0.9, speed: 3 },
	{ angle: -160, h: 0.58, w: 0.88, phase: 2.2, speed: 3 },
	{ angle: 180, h: 0.5, w: 0.8, phase: 0.4, speed: 3 },
	{ angle: -30, h: 0.5, w: 0.78, phase: 1.0, speed: 4 },
	{ angle: -150, h: 0.5, w: 0.78, phase: 2.7, speed: 4 },
];

const EMBERS = [
	{ angle: -45, phase: 0.0, drift: 0.3, scale: 1.0, speed: 1 },
	{ angle: -70, phase: 0.35, drift: -0.2, scale: 0.7, speed: 1 },
	{ angle: -90, phase: 0.6, drift: 0.15, scale: 1.2, speed: 2 },
	{ angle: -110, phase: 0.2, drift: -0.3, scale: 0.8, speed: 1 },
	{ angle: -135, phase: 0.8, drift: 0.25, scale: 0.9, speed: 2 },
	{ angle: -60, phase: 0.5, drift: -0.1, scale: 0.6, speed: 2 },
];

const SHARDS = [
	{ angle: -90, len: 0.26, w: 0.06, phase: 0.0 },
	{ angle: -68, len: 0.19, w: 0.05, phase: 0.9 },
	{ angle: -112, len: 0.19, w: 0.05, phase: 1.7 },
	{ angle: -48, len: 0.14, w: 0.042, phase: 2.4 },
	{ angle: -132, len: 0.14, w: 0.042, phase: 2.9 },
	{ angle: -22, len: 0.1, w: 0.034, phase: 1.2 },
	{ angle: 12, len: 0.08, w: 0.03, phase: 0.4 },
	{ angle: -158, len: 0.1, w: 0.034, phase: 2.0 },
	{ angle: 168, len: 0.08, w: 0.03, phase: 0.7 },
	{ angle: 78, len: 0.06, w: 0.024, phase: 1.5 },
	{ angle: 102, len: 0.06, w: 0.024, phase: 2.7 },
];

const GLINTS = [
	{ x: 0.18, y: 0.1, r: 0.09, phase: 0.0 },
	{ x: 0.85, y: 0.3, r: 0.07, phase: 1.4 },
	{ x: 0.6, y: -0.08, r: 0.08, phase: 2.6 },
	{ x: -0.06, y: 0.55, r: 0.06, phase: 3.4 },
];

interface ClockProps {
	g: Geometry;
	clock: SharedValue<number>;
}

function Flame({ g, clock, angle, h, w, phase, speed }: ClockProps & (typeof FLAMES)[number]) {
	const rad = (angle * Math.PI) / 180;
	const bx = g.c + Math.cos(rad) * g.r * 0.95;
	const by = g.c + Math.sin(rad) * g.r * 0.95;
	const flameH = g.size * 0.36 * h;
	const flameW = g.size * 0.15 * w;

	const opacity = useDerivedValue(() => 0.65 + 0.35 * Math.sin(clock.value * speed + phase + 0.8));
	const transform = useDerivedValue(() => [
		{ rotate: rad + Math.PI / 2 },
		{ scaleY: 0.75 + 0.25 * Math.sin(clock.value * speed + phase) },
		{ scaleX: 0.92 + 0.08 * Math.sin(clock.value * (speed + 2) + phase * 2) },
	]);

	return (
		<Group blendMode="plus" origin={vec(bx, by)} opacity={opacity} transform={transform}>
			<Path path={flamePath(bx, by, flameW, flameH)} color="#ff3d00">
				<BlurMask blur={g.size * 0.09} {...BLUR_NORMAL} />
			</Path>
			<Path path={flamePath(bx, by, flameW * 0.62, flameH * 0.68)} color="#ff9500">
				<BlurMask blur={g.size * 0.05} {...BLUR_NORMAL} />
			</Path>
			<Path path={flamePath(bx, by, flameW * 0.34, flameH * 0.42)} color="#ffd54f">
				<BlurMask blur={g.size * 0.03} {...BLUR_NORMAL} />
			</Path>
		</Group>
	);
}

function Ember({
	g,
	clock,
	angle,
	phase,
	drift,
	scale,
	speed,
}: ClockProps & (typeof EMBERS)[number]) {
	const rad = (angle * Math.PI) / 180;
	const sx = g.c + Math.cos(rad) * g.r;
	const sy = g.c + Math.sin(rad) * g.r;

	const p = useDerivedValue(() => ((clock.value / TAU) * speed + phase) % 1);
	const cx = useDerivedValue(
		() => sx + Math.sin(p.value * 5 + phase * 7) * g.size * 0.1 + drift * p.value * g.size * 0.3
	);
	const cy = useDerivedValue(() => sy - p.value * g.size * 1.05);
	const opacity = useDerivedValue(() => (1 - p.value) * 0.9);
	const r = useDerivedValue(() => g.size * 0.035 * scale * (1 - p.value * 0.5));

	return (
		<Circle cx={cx} cy={cy} r={r} color="#ffcc66" opacity={opacity} blendMode="plus">
			<BlurMask blur={g.size * 0.02} {...BLUR_NORMAL} />
		</Circle>
	);
}

function FireBack({ g, clock }: ClockProps) {
	const glowOpacity = useDerivedValue(() => 0.7 + 0.3 * Math.sin(clock.value));
	const glowTransform = useDerivedValue(() => [{ scale: 1 + 0.04 * Math.sin(clock.value) }]);

	return (
		<>
			<Group origin={vec(g.c, g.c)} opacity={glowOpacity} transform={glowTransform}>
				<Circle cx={g.c} cy={g.c} r={g.r * 1.7}>
					<RadialGradient
						c={vec(g.c, g.c)}
						r={g.r * 1.7}
						colors={["rgba(255,90,0,0.5)", "rgba(255,60,0,0.18)", "rgba(255,60,0,0)"]}
					/>
				</Circle>
				<Circle cx={g.c} cy={g.c + g.r * 0.4} r={g.r * 1.1}>
					<RadialGradient
						c={vec(g.c, g.c + g.r * 0.4)}
						r={g.r * 1.1}
						colors={["rgba(255,140,0,0.55)", "rgba(255,80,0,0)"]}
					/>
				</Circle>
			</Group>
			{FLAMES.map((f) => (
				<Flame key={f.angle} g={g} clock={clock} {...f} />
			))}
		</>
	);
}

function FireFront({ g, clock, sweepClock }: ClockProps & { sweepClock: SharedValue<number> }) {
	const clip = rrect(rect(g.ext, g.ext, g.size, g.size), g.radius, g.radius);

	const sweepP = useDerivedValue(() => sweepClock.value / TAU);
	const sweepOpacity = useDerivedValue(() => Math.sin(sweepP.value * Math.PI) * 0.16);
	const sweepTransform = useDerivedValue(() => [
		{ rotate: Math.PI / 5 },
		{ translateX: -g.canvas + sweepP.value * g.canvas * 2 },
	]);

	return (
		<>
			<RoundedRect
				x={g.ext}
				y={g.ext}
				width={g.size}
				height={g.size}
				r={g.radius}
				{...STROKE}
				strokeWidth={g.size * 0.05}
			>
				<LinearGradient
					start={vec(g.ext, g.ext)}
					end={vec(g.ext + g.size, g.ext + g.size)}
					colors={["#ffcc00", "#ff6a00", "#ff4500", "#ff8c00"]}
				/>
				<BlurMask blur={g.size * 0.04} {...BLUR_NORMAL} />
			</RoundedRect>
			<RoundedRect
				x={g.ext}
				y={g.ext}
				width={g.size}
				height={g.size}
				r={g.radius}
				{...STROKE}
				strokeWidth={g.size * 0.02}
				color="#ffb300"
				opacity={0.8}
			/>
			{EMBERS.map((e) => (
				<Ember key={e.angle} g={g} clock={clock} {...e} />
			))}
			<Group clip={clip} opacity={sweepOpacity}>
				<Group origin={vec(g.c, g.c)} transform={sweepTransform}>
					<Rect x={-g.size * 0.2} y={-g.canvas} width={g.size * 0.4} height={g.canvas * 3}>
						<LinearGradient
							start={vec(-g.size * 0.2, 0)}
							end={vec(g.size * 0.2, 0)}
							colors={["rgba(255,255,255,0)", "rgba(255,255,235,0.9)", "rgba(255,255,255,0)"]}
						/>
					</Rect>
				</Group>
			</Group>
			<Circle
				cx={g.ext + g.size * 0.22}
				cy={g.ext + g.size * 0.18}
				r={g.size * 0.12}
				color="#ffffff"
				opacity={0.25}
				blendMode="screen"
			>
				<BlurMask blur={g.size * 0.06} {...BLUR_NORMAL} />
			</Circle>
		</>
	);
}

function Shard({ g, clock, angle, len, w, phase }: ClockProps & (typeof SHARDS)[number]) {
	const rad = (angle * Math.PI) / 180;
	const baseR = g.r * 0.98;
	const length = g.size * len;
	const width = g.size * w;
	const bx = g.c + Math.cos(rad) * baseR;
	const by = g.c + Math.sin(rad) * baseR;
	const tx = g.c + Math.cos(rad) * (baseR + length);
	const ty = g.c + Math.sin(rad) * (baseR + length);

	const opacity = useDerivedValue(() => 0.78 + 0.22 * Math.sin(clock.value + phase + 1.2));
	const transform = useDerivedValue(() => [{ scale: 1 + 0.12 * Math.sin(clock.value + phase) }]);

	return (
		<Group origin={vec(bx, by)} opacity={opacity} transform={transform}>
			<Path path={shardPath(g.c, g.c, baseR, angle, length, width)}>
				<LinearGradient
					start={vec(bx, by)}
					end={vec(tx, ty)}
					colors={["rgba(240,252,255,1)", "rgba(160,220,245,0.78)", "rgba(60,200,255,0.2)"]}
				/>
				<BlurMask blur={g.size * 0.02} {...BLUR_NORMAL} />
			</Path>
		</Group>
	);
}

function Glint({ g, clock, x, y, r, phase }: ClockProps & (typeof GLINTS)[number]) {
	const px = g.ext + x * g.size;
	const py = g.ext + y * g.size;
	const size = g.size * r;

	const twinkle = useDerivedValue(() => Math.max(0, Math.sin(clock.value + phase)));
	const opacity = useDerivedValue(() => twinkle.value * twinkle.value);
	const transform = useDerivedValue(() => [{ scale: 0.5 + 0.6 * twinkle.value }]);

	return (
		<Group origin={vec(px, py)} transform={transform} opacity={opacity} blendMode="screen">
			<Path path={starPath(px, py, size)} color="#ffffff">
				<BlurMask blur={g.size * 0.012} {...BLUR_NORMAL} />
			</Path>
		</Group>
	);
}

function IceBack({ g, clock }: ClockProps) {
	const glowOpacity = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value));

	return (
		<>
			<Circle cx={g.c} cy={g.c} r={g.r * 1.75} opacity={glowOpacity}>
				<RadialGradient
					c={vec(g.c, g.c)}
					r={g.r * 1.75}
					colors={["rgba(150,215,245,0.6)", "rgba(0,191,255,0.22)", "rgba(0,191,255,0)"]}
				/>
			</Circle>
			{SHARDS.map((s) => (
				<Shard key={s.angle} g={g} clock={clock} {...s} />
			))}
		</>
	);
}

function IceFront({ g, clock }: ClockProps) {
	const frostOpacity = useDerivedValue(() => 0.9 + 0.1 * Math.sin(clock.value));
	const sheenTransform = useDerivedValue(() => [{ rotate: clock.value * 0.5 }]);

	return (
		<>
			<RoundedRect
				x={g.ext}
				y={g.ext}
				width={g.size}
				height={g.size}
				r={g.radius}
				opacity={frostOpacity}
			>
				<RadialGradient
					c={vec(g.c, g.c)}
					r={g.size * 0.72}
					colors={[
						"rgba(255,255,255,0)",
						"rgba(210,240,255,0)",
						"rgba(190,230,255,0.5)",
						"rgba(240,250,255,0.85)",
					]}
					positions={[0, 0.45, 0.78, 1]}
				/>
				<BlurMask blur={g.size * 0.02} {...BLUR_NORMAL} />
			</RoundedRect>
			<RoundedRect
				x={g.ext}
				y={g.ext}
				width={g.size}
				height={g.size}
				r={g.radius}
				color="rgba(140,190,255,0.16)"
			/>
			<RoundedRect
				x={g.ext}
				y={g.ext}
				width={g.size}
				height={g.size}
				r={g.radius}
				{...STROKE}
				strokeWidth={g.size * 0.055}
			>
				<LinearGradient
					start={vec(g.ext, g.ext)}
					end={vec(g.ext + g.size, g.ext + g.size)}
					colors={["#e0f7ff", "#87ceeb", "#00bfff", "#b0e0ff"]}
				/>
				<BlurMask blur={g.size * 0.04} {...BLUR_NORMAL} />
			</RoundedRect>
			<RoundedRect
				x={g.ext}
				y={g.ext}
				width={g.size}
				height={g.size}
				r={g.radius}
				{...STROKE}
				strokeWidth={g.size * 0.022}
				color="#ddf2fd"
				opacity={0.95}
			/>
			<Group origin={vec(g.c, g.c)} transform={sheenTransform} opacity={0.65}>
				<Path
					path={arcPath(g.c, g.c, g.r * 1.02, 0, 70)}
					{...STROKE}
					strokeWidth={g.size * 0.045}
					strokeCap="round"
				>
					<LinearGradient
						start={vec(g.c - g.r, g.c - g.r)}
						end={vec(g.c + g.r, g.c + g.r)}
						colors={["rgba(255,255,255,0)", "rgba(230,248,255,0.9)", "rgba(255,255,255,0)"]}
					/>
				</Path>
			</Group>
			{GLINTS.map((gl) => (
				<Glint key={`${gl.x}-${gl.y}`} g={g} clock={clock} {...gl} />
			))}
		</>
	);
}

interface StreakAvatarProps {
	name: string;
	image?: string | null;
	headers?: Record<string, string>;
	streak: number;
	size?: number;
}

function StreakEffect({
	g,
	type,
	name,
	image,
	headers,
}: {
	g: Geometry;
	type: Exclude<StreakType, "none">;
	name: string;
	image?: string | null;
	headers?: Record<string, string>;
}) {
	const clock = useClock(type === "fire" ? 1800 : 3200);
	const sweepClock = useClock(5200);

	const canvasStyle = {
		position: "absolute" as const,
		left: -g.ext,
		top: -g.ext,
		width: g.canvas,
		height: g.canvas,
	};

	return (
		<View style={{ width: g.size, height: g.size }}>
			<View style={canvasStyle} pointerEvents="none">
				<Canvas style={StyleSheet.absoluteFill}>
					{type === "fire" ? <FireBack g={g} clock={clock} /> : <IceBack g={g} clock={clock} />}
				</Canvas>
			</View>
			<Avatar name={name} image={image} headers={headers} size={g.size} borderRadius={g.radius} />
			<View style={canvasStyle} pointerEvents="none">
				<Canvas style={StyleSheet.absoluteFill}>
					{type === "fire" ? (
						<FireFront g={g} clock={clock} sweepClock={sweepClock} />
					) : (
						<IceFront g={g} clock={clock} />
					)}
				</Canvas>
			</View>
		</View>
	);
}

export function StreakAvatar({ name, image, headers, streak, size = 36 }: StreakAvatarProps) {
	const type = getStreakType(streak);

	if (type === "none") {
		return <Avatar name={name} image={image} headers={headers} size={size} />;
	}

	return (
		<StreakEffect g={geometry(size)} type={type} name={name} image={image} headers={headers} />
	);
}
