import "./streak-animations.css";
import { cn } from "@/lib/utils";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { useId } from "react";

type StreakType = "fire" | "ice" | "none";

interface StreakAvatarProps {
	src?: string | null;
	name?: string | null;
	streak: number;
	className?: string;
	size?: number;
}

function getStreakType(streak: number): StreakType {
	if (streak >= 5) return "fire";
	if (streak <= -5) return "ice";
	return "none";
}

/**
 * Spark data: each spark sits at a specific angle on the ring path and twinkles.
 */
const SPARKS = [
	{ angle: 0, r: 1.0, anim: "animate-spark-1" },
	{ angle: 30, r: 0.7, anim: "animate-spark-2" },
	{ angle: 55, r: 0.85, anim: "animate-spark-3" },
	{ angle: 80, r: 0.6, anim: "animate-spark-4" },
	{ angle: 110, r: 0.9, anim: "animate-spark-5" },
	{ angle: 140, r: 0.65, anim: "animate-spark-6" },
	{ angle: 165, r: 0.8, anim: "animate-spark-1" },
	{ angle: 195, r: 0.7, anim: "animate-spark-3" },
	{ angle: 220, r: 0.95, anim: "animate-spark-5" },
	{ angle: 250, r: 0.6, anim: "animate-spark-2" },
	{ angle: 280, r: 0.85, anim: "animate-spark-4" },
	{ angle: 310, r: 0.75, anim: "animate-spark-6" },
	{ angle: 340, r: 0.9, anim: "animate-spark-3" },
	{ angle: 15, r: 0.5, anim: "animate-spark-4" },
	{ angle: 95, r: 0.55, anim: "animate-spark-1" },
	{ angle: 185, r: 0.5, anim: "animate-spark-5" },
	{ angle: 265, r: 0.55, anim: "animate-spark-2" },
];

/**
 * Comet/shooting-star trails that orbit the ring.
 * Each has: startAngle, arc sweep length (degrees), head width, animation class, color.
 * The trail tapers from thick (head) to nothing (tail) using a gradient along the path.
 */
const COMETS = [
	{ startAngle: 5, sweep: 42, headWidth: 1.0, anim: "animate-comet-1", color: "#ffcc00" },
	{ startAngle: 35, sweep: 25, headWidth: 0.6, anim: "animate-comet-8", color: "#ff6a00" },
	{ startAngle: 65, sweep: 30, headWidth: 0.7, anim: "animate-comet-2", color: "#ff8c00" },
	{ startAngle: 95, sweep: 35, headWidth: 0.85, anim: "animate-comet-9", color: "#ffcc00" },
	{ startAngle: 125, sweep: 38, headWidth: 0.9, anim: "animate-comet-3", color: "#ff6a00" },
	{ startAngle: 155, sweep: 28, headWidth: 0.65, anim: "animate-comet-10", color: "#ff8c00" },
	{ startAngle: 185, sweep: 34, headWidth: 0.75, anim: "animate-comet-4", color: "#ffcc00" },
	{ startAngle: 215, sweep: 40, headWidth: 0.95, anim: "animate-comet-11", color: "#ff4500" },
	{ startAngle: 245, sweep: 45, headWidth: 0.95, anim: "animate-comet-5", color: "#ff4500" },
	{ startAngle: 275, sweep: 26, headWidth: 0.6, anim: "animate-comet-12", color: "#ffcc00" },
	{ startAngle: 305, sweep: 28, headWidth: 0.65, anim: "animate-comet-6", color: "#ff8c00" },
	{ startAngle: 335, sweep: 36, headWidth: 0.8, anim: "animate-comet-7", color: "#ffcc00" },
];

/**
 * Build an SVG path along an ellipse from angle1 to angle2 (degrees).
 * Uses cubic bezier segments to approximate the ellipse arc.
 */
function ellipseArcPath(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	startDeg: number,
	endDeg: number,
	steps: number
): string {
	const pts: { x: number; y: number }[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = startDeg + (endDeg - startDeg) * (i / steps);
		const rad = (t * Math.PI) / 180;
		pts.push({ x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) });
	}
	let d = `M${pts[0].x},${pts[0].y}`;
	for (let i = 1; i < pts.length; i++) {
		d += ` L${pts[i].x},${pts[i].y}`;
	}
	return d;
}

/**
 * Fire: sparkling border on fire + comet shooting-star trails orbiting around.
 */
function FireEffect({ size }: { size: number }) {
	const id = useId();
	const ext = size * 0.14;
	const topExt = size * 0.2;
	const svgW = size + ext * 2;
	const svgH = size + topExt + ext;

	const cx = svgW / 2;
	const cy = topExt + size / 2;

	const rx = size / 2 + ext * 0.5;
	const ry = size / 2 + (topExt + ext) * 0.35;

	const s = size / 48;
	const sparkBaseR = Math.max(1, s * 1.4);

	return (
		<div
			className="absolute pointer-events-none z-0"
			style={{
				top: -topExt,
				left: -ext,
				width: svgW,
				height: svgH,
			}}
			aria-hidden="true"
		>
			{/* Main SVG with defs, base ring, and sparkles */}
			<svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="absolute inset-0">
				<defs>
					{/* Base ring gradient */}
					<linearGradient
						id={`${id}-ring`}
						gradientUnits="userSpaceOnUse"
						x1={cx - rx}
						y1={cy}
						x2={cx + rx}
						y2={cy}
					>
						<stop offset="0%" stopColor="#ff4500" stopOpacity="0.7" />
						<stop offset="30%" stopColor="#ff8c00" stopOpacity="0.5" />
						<stop offset="60%" stopColor="#ffcc00" stopOpacity="0.7" />
						<stop offset="100%" stopColor="#ff4500" stopOpacity="0.6" />
					</linearGradient>

					{/* Ambient warm glow */}
					<radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
						<stop offset="0%" stopColor="#ff6a00" stopOpacity="0.12" />
						<stop offset="60%" stopColor="#ff4500" stopOpacity="0.04" />
						<stop offset="100%" stopColor="#ff4500" stopOpacity="0" />
					</radialGradient>

					{/* Spark glow filter */}
					<filter id={`${id}-sparkglow`} x="-100%" y="-100%" width="300%" height="300%">
						<feGaussianBlur stdDeviation={0.5 * s} result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>

					{/* Softer glow for the base ring */}
					<filter id={`${id}-ringblur`} x="-10%" y="-10%" width="120%" height="120%">
						<feGaussianBlur stdDeviation={0.8 * s} />
					</filter>

					{/* Comet trail gradients -- opacity tapers from head (1) to tail (0) */}
					{COMETS.map((comet, i) => (
						<linearGradient
							key={i}
							id={`${id}-comet-${i}`}
							x1="0%"
							y1="0%"
							x2="100%"
							y2="0%"
							gradientUnits="objectBoundingBox"
						>
							<stop offset="0%" stopColor={comet.color} stopOpacity="0" />
							<stop offset="70%" stopColor={comet.color} stopOpacity="0.6" />
							<stop offset="100%" stopColor="#fff8e1" stopOpacity="0.95" />
						</linearGradient>
					))}

					{/* Soft comet glow */}
					<filter id={`${id}-cometglow`} x="-20%" y="-50%" width="140%" height="200%">
						<feGaussianBlur stdDeviation={0.6 * s} result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>

				{/* Subtle ambient glow */}
				<ellipse
					cx={cx}
					cy={cy}
					rx={rx * 1.03}
					ry={ry * 1.03}
					fill={`url(#${id}-glow)`}
					className="animate-fire-pulse"
				/>

				{/* Base ring: thin, warm, slightly glowy */}
				<ellipse
					cx={cx}
					cy={cy}
					rx={rx}
					ry={ry}
					fill="none"
					stroke={`url(#${id}-ring)`}
					strokeWidth={1.2 * s}
					filter={`url(#${id}-ringblur)`}
				/>

				{/* Crisp thin ring for definition */}
				<ellipse
					cx={cx}
					cy={cy}
					rx={rx}
					ry={ry}
					fill="none"
					stroke={`url(#${id}-ring)`}
					strokeWidth={0.6 * s}
					strokeOpacity="0.6"
				/>

				{/* Sparkle points along the ring */}
				{SPARKS.map((spark, i) => {
					const rad = (spark.angle * Math.PI) / 180;
					const sx = cx + rx * Math.cos(rad);
					const sy = cy + ry * Math.sin(rad);
					const r = sparkBaseR * spark.r;
					const colors = ["#fff8e1", "#ffdd57", "#ff8c00", "#fff3c4", "#ffcc00"];
					const color = colors[i % colors.length];

					return (
						<g key={i} className={spark.anim} filter={`url(#${id}-sparkglow)`}>
							<line
								x1={sx - r * 1.2}
								y1={sy}
								x2={sx + r * 1.2}
								y2={sy}
								stroke={color}
								strokeWidth={r * 0.5}
								strokeLinecap="round"
							/>
							<line
								x1={sx}
								y1={sy - r * 1.2}
								x2={sx}
								y2={sy + r * 1.2}
								stroke={color}
								strokeWidth={r * 0.5}
								strokeLinecap="round"
							/>
							<circle cx={sx} cy={sy} r={r * 0.4} fill="#ffffff" opacity="0.9" />
						</g>
					);
				})}
			</svg>

			{/* Comet trails: each on its own rotating SVG layer */}
			{COMETS.map((comet, i) => {
				// Build a tapered path: the head is at startAngle+sweep, tail at startAngle
				const tailAngle = comet.startAngle;
				const headAngle = comet.startAngle + comet.sweep;
				const pathD = ellipseArcPath(cx, cy, rx, ry, tailAngle, headAngle, 24);
				const headRad = (headAngle * Math.PI) / 180;
				const headX = cx + rx * Math.cos(headRad);
				const headY = cy + ry * Math.sin(headRad);
				const headR = s * 1.2 * comet.headWidth;

				return (
					<svg
						key={i}
						width={svgW}
						height={svgH}
						viewBox={`0 0 ${svgW} ${svgH}`}
						className={`absolute inset-0 ${comet.anim}`}
						style={{ transformOrigin: `${cx}px ${cy}px` }}
					>
						{/* Tapered trail: stroke the path with the gradient */}
						<path
							d={pathD}
							fill="none"
							stroke={`url(#${id}-comet-${i})`}
							strokeWidth={2 * s * comet.headWidth}
							strokeLinecap="round"
							filter={`url(#${id}-cometglow)`}
						/>
						{/* Bright head dot */}
						<circle cx={headX} cy={headY} r={headR} fill="#fff8e1" opacity="0.9" />
						<circle cx={headX} cy={headY} r={headR * 2} fill={comet.color} opacity="0.3" />
					</svg>
				);
			})}
		</div>
	);
}

/**
 * Ice: Frosted aura around the avatar with shimmering shards on all sides,
 * slightly more pronounced on top.
 */
function IceEffect({ size }: { size: number }) {
	const id = useId();
	const ext = size * 0.16;
	const topExt = size * 0.22;
	const svgW = size + ext * 2;
	const svgH = size + topExt + ext;

	const cx = svgW / 2;
	const cy = topExt + size / 2;
	const rx = size / 2 + ext * 0.5;
	const ry = size / 2 + (topExt + ext) * 0.35;

	function shard(angle: number, length: number, width: number) {
		const rad = (angle * Math.PI) / 180;
		const ex = cx + rx * Math.cos(rad);
		const ey = cy + ry * Math.sin(rad);
		const tx = cx + (rx + length) * Math.cos(rad);
		const ty = cy + (ry + length) * Math.sin(rad);
		const px = -Math.sin(rad) * width;
		const py = Math.cos(rad) * width;
		return `${ex + px},${ey + py} ${tx},${ty} ${ex - px},${ey - py}`;
	}

	return (
		<div
			className="absolute pointer-events-none z-0"
			style={{
				top: -topExt,
				left: -ext,
				width: svgW,
				height: svgH,
			}}
			aria-hidden="true"
		>
			<svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="absolute inset-0">
				<defs>
					<radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="50%">
						<stop offset="0%" stopColor="#87ceeb" stopOpacity="0.2" />
						<stop offset="50%" stopColor="#00bfff" stopOpacity="0.08" />
						<stop offset="100%" stopColor="#00bfff" stopOpacity="0" />
					</radialGradient>
					<radialGradient id={`${id}-shard`} cx="30%" cy="30%" r="80%">
						<stop offset="0%" stopColor="#e0f7ff" stopOpacity="0.9" />
						<stop offset="40%" stopColor="#87ceeb" stopOpacity="0.65" />
						<stop offset="100%" stopColor="#00bfff" stopOpacity="0.05" />
					</radialGradient>
					<filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="0.8" result="b" />
						<feMerge>
							<feMergeNode in="b" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
					<filter id={`${id}-gblur`} x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="1.8" />
					</filter>
				</defs>

				{/* Ambient frost glow */}
				<ellipse
					cx={cx}
					cy={cy}
					rx={rx * 1.05}
					ry={ry * 1.05}
					fill={`url(#${id}-glow)`}
					className="animate-ice-pulse"
				/>

				{/* Frost ring */}
				<ellipse
					cx={cx}
					cy={cy}
					rx={rx * 0.96}
					ry={ry * 0.96}
					fill="none"
					stroke="#87ceeb"
					strokeWidth={size * 0.035}
					strokeOpacity="0.3"
					filter={`url(#${id}-gblur)`}
					className="animate-ice-pulse"
				/>

				{/* Top shards (taller, more prominent) */}
				<polygon
					points={shard(-90, size * 0.14, size * 0.04)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-1"
				/>
				<polygon
					points={shard(-70, size * 0.1, size * 0.03)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-2"
				/>
				<polygon
					points={shard(-110, size * 0.1, size * 0.03)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-3"
				/>
				<polygon
					points={shard(-50, size * 0.07, size * 0.025)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-4"
				/>
				<polygon
					points={shard(-130, size * 0.07, size * 0.025)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-5"
				/>

				{/* Side shards */}
				<polygon
					points={shard(-20, size * 0.06, size * 0.02)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-3"
					opacity="0.6"
				/>
				<polygon
					points={shard(10, size * 0.05, size * 0.018)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-1"
					opacity="0.5"
				/>
				<polygon
					points={shard(-160, size * 0.06, size * 0.02)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-5"
					opacity="0.6"
				/>
				<polygon
					points={shard(170, size * 0.05, size * 0.018)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-2"
					opacity="0.5"
				/>

				{/* Bottom shards (smallest) */}
				<polygon
					points={shard(80, size * 0.04, size * 0.015)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-4"
					opacity="0.4"
				/>
				<polygon
					points={shard(100, size * 0.04, size * 0.015)}
					fill={`url(#${id}-shard)`}
					filter={`url(#${id}-blur)`}
					className="animate-ice-shard-1"
					opacity="0.4"
				/>

				{/* Floating particles */}
				<circle
					cx={cx - rx * 0.5}
					cy={cy - ry * 0.9}
					r="1.8"
					fill="#e0f7ff"
					className="animate-ice-particle-1"
					opacity="0.8"
				/>
				<circle
					cx={cx + rx * 0.5}
					cy={cy - ry * 0.85}
					r="1.8"
					fill="#87ceeb"
					className="animate-ice-particle-2"
					opacity="0.7"
				/>
				<circle
					cx={cx}
					cy={cy - ry * 1.05}
					r="1.2"
					fill="#e0f7ff"
					className="animate-ice-particle-3"
					opacity="0.6"
				/>
				<circle
					cx={cx - rx * 0.95}
					cy={cy}
					r="1.2"
					fill="#b0e0ff"
					className="animate-ice-particle-4"
					opacity="0.5"
				/>
				<circle
					cx={cx + rx * 0.95}
					cy={cy}
					r="1.2"
					fill="#b0e0ff"
					className="animate-ice-particle-5"
					opacity="0.5"
				/>
			</svg>
		</div>
	);
}

export function StreakAvatar({ src, name, streak, className, size = 48 }: StreakAvatarProps) {
	const streakType = getStreakType(streak);

	const avatarSize = size <= 24 ? "sm" : size <= 32 ? "md" : size <= 40 ? "lg" : "xl";
	const isLarge = size >= 80;

	return (
		<div
			className="relative inline-block isolate flex-shrink-0"
			style={{ width: size, height: size, overflow: "visible" }}
		>
			{streakType === "fire" && <FireEffect size={size} />}
			{streakType === "ice" && <IceEffect size={size} />}

			{!src && streakType !== "none" && (
				<div
					className={cn("absolute inset-0 z-10 bg-background", !isLarge && "rounded-lg")}
					style={isLarge ? { borderRadius: size * 0.22 } : undefined}
				/>
			)}

			<AvatarWithFallback
				src={src}
				name={name}
				size={avatarSize}
				className={cn(
					"relative z-20 !size-full",
					isLarge ? "ring-4" : "ring-2",
					streakType === "fire" &&
						(isLarge
							? "ring-orange-500/50 shadow-[0_0_12px_6px_rgba(255,100,0,0.45),0_0_28px_12px_rgba(255,80,0,0.2),0_0_48px_20px_rgba(255,60,0,0.08)]"
							: "ring-orange-500/60 shadow-[0_0_8px_rgba(255,100,0,0.35)]"),
					streakType === "ice" &&
						(isLarge
							? "ring-sky-400/50 shadow-[0_0_12px_6px_rgba(0,180,255,0.4),0_0_28px_12px_rgba(0,150,255,0.18),0_0_48px_20px_rgba(0,120,255,0.06)]"
							: "ring-sky-400/60 shadow-[0_0_8px_rgba(0,180,255,0.3)]"),
					streakType === "none" && "ring-border",
					className
				)}
				style={isLarge ? { borderRadius: size * 0.22 } : undefined}
			/>
		</div>
	);
}
