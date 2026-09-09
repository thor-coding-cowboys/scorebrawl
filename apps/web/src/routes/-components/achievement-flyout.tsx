import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { achievementCatalog } from "@/lib/achievements";
import { HugeiconsIcon } from "@hugeicons/react";
import "@/lib/event-types";
import "./achievement-animations.css";

export interface AchievementFlyoutEvent {
	playerId: string;
	playerName: string;
	playerImage?: string | null;
	type: string;
	timestamp: number;
}

const CONFETTI_COLORS = [
	"#f97316",
	"#22c55e",
	"#3b82f6",
	"#eab308",
	"#a855f7",
	"#ec4899",
	"#06b6d4",
];

const CONFETTI_COUNT = 120;

function Confetti() {
	const pieces = useRef(
		Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
			id: i,
			left: Math.random() * 100,
			delay: Math.random() * 1.5,
			duration: 2.5 + Math.random() * 2,
			color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
			width: 6 + Math.random() * 6,
			height: 10 + Math.random() * 8,
			rotate: Math.random() * 360,
		}))
	).current;

	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
			{pieces.map((p) => (
				<div
					key={p.id}
					className="absolute"
					style={{
						left: `${p.left}%`,
						top: "-10%",
						width: p.width,
						height: p.height,
						backgroundColor: p.color,
						opacity: 0,
						borderRadius: 2,
						animation: `achievement-confetti ${p.duration}s ease-in ${p.delay}s forwards`,
						["--rotate" as string]: `${p.rotate}deg`,
					}}
				/>
			))}
		</div>
	);
}

function RadialBurst() {
	const lines = useRef(
		Array.from({ length: 36 }, (_, i) => ({
			id: i,
			angle: i * 10,
			delay: Math.random() * 0.5,
		}))
	).current;

	return (
		<div
			className="absolute inset-0 flex items-center justify-center pointer-events-none"
			aria-hidden="true"
		>
			{lines.map((l) => (
				<div
					key={l.id}
					className="absolute w-px origin-bottom bg-gradient-to-t from-fuchsia-500/60 to-transparent"
					style={
						{
							height: "40vh",
							"--angle": `${l.angle}deg`,
							opacity: 0,
							animation: `achievement-burst 0.8s ease-out ${l.delay}s forwards`,
						} as React.CSSProperties
					}
				/>
			))}
		</div>
	);
}

type Phase = "hidden" | "entering" | "visible" | "exiting";

function getEventId(event: AchievementFlyoutEvent): string {
	return `${event.playerId}-${event.type}`;
}

function getShownEvents(): Set<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const stored = sessionStorage.getItem("achievement-events-shown");
		if (stored) return new Set(JSON.parse(stored));
	} catch {
		// ignore
	}
	return new Set();
}

function addShownEvent(eventId: string) {
	if (typeof window === "undefined") return;
	try {
		const shown = getShownEvents();
		shown.add(eventId);
		const arr = Array.from(shown).slice(-100);
		sessionStorage.setItem("achievement-events-shown", JSON.stringify(arr));
	} catch {
		// ignore
	}
}

export function AchievementFlyout() {
	const [currentEvent, setCurrentEvent] = useState<AchievementFlyoutEvent | null>(null);
	const [phase, setPhase] = useState<Phase>("hidden");
	const eventQueue = useRef<AchievementFlyoutEvent[]>([]);
	const isShowing = useRef(false);
	const mountTime = useRef(Date.now());
	const processRef = useRef<(() => void) | null>(null);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const canDismiss = useRef(false);

	const clearTimers = useCallback(() => {
		for (const t of timers.current) clearTimeout(t);
		timers.current = [];
	}, []);

	const dismiss = useCallback(() => {
		if (!canDismiss.current) return;
		clearTimers();
		setPhase("exiting");
		timers.current.push(
			setTimeout(() => {
				setPhase("hidden");
				setCurrentEvent(null);
				isShowing.current = false;
				processRef.current?.();
			}, 600)
		);
	}, [clearTimers]);

	const processNext = useCallback(() => {
		if (eventQueue.current.length === 0 || isShowing.current) return;

		isShowing.current = true;
		const next = eventQueue.current.shift();
		if (!next) {
			isShowing.current = false;
			return;
		}

		setCurrentEvent(next);
		setPhase("entering");

		canDismiss.current = false;
		clearTimers();
		timers.current.push(
			setTimeout(() => {
				setPhase("visible");
				timers.current.push(
					setTimeout(() => {
						canDismiss.current = true;
					}, 1000)
				);
				timers.current.push(
					setTimeout(() => {
						setPhase("exiting");
						timers.current.push(
							setTimeout(() => {
								setPhase("hidden");
								setCurrentEvent(null);
								isShowing.current = false;
								processRef.current?.();
							}, 600)
						);
					}, 5000)
				);
			}, 600)
		);
	}, [clearTimers]);

	processRef.current = processNext;

	const queueEvent = useCallback((event: AchievementFlyoutEvent) => {
		if (event.timestamp < mountTime.current - 5000) return;

		const id = getEventId(event);
		if (getShownEvents().has(id)) return;
		addShownEvent(id);

		eventQueue.current.push(event);
		processRef.current?.();
	}, []);

	useEffect(() => {
		mountTime.current = Date.now();

		const handler = (e: Event) => {
			const detail = (e as CustomEvent<AchievementFlyoutEvent>).detail;
			if (detail?.playerId && detail?.type) queueEvent(detail);
		};

		window.addEventListener("achievement-event", handler);
		return () => window.removeEventListener("achievement-event", handler);
	}, [queueEvent]);

	if (!currentEvent || phase === "hidden") return null;

	const meta =
		achievementCatalog[currentEvent.type as keyof typeof achievementCatalog] ??
		achievementCatalog["5_win_streak"];

	return (
		<div
			className={cn(
				"fixed inset-0 z-[100] flex flex-col items-center justify-center",
				"transition-opacity duration-500",
				phase === "entering" && "opacity-0",
				phase === "visible" && "opacity-100",
				phase === "exiting" && "opacity-0 pointer-events-none"
			)}
			onClick={dismiss}
		>
			{/* Background */}
			<div className="absolute inset-0 bg-gradient-to-b from-black via-fuchsia-950/80 to-black" />

			{/* Vignette */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,black_80%)]" />

			{/* Radial burst lines */}
			{phase !== "exiting" && <RadialBurst />}

			{/* Confetti */}
			<Confetti />

			{/* Ring pulse behind icon */}
			<div
				className={cn(
					"absolute rounded-full bg-fuchsia-500/10 shadow-[0_0_120px_60px_rgba(217,70,239,0.15)]",
					"transition-all duration-700",
					phase === "entering" && "scale-0 opacity-0",
					phase === "visible" && "scale-100 opacity-100",
					phase === "exiting" && "scale-150 opacity-0"
				)}
				style={{ width: 280, height: 280 }}
			/>

			{/* Content */}
			<div className="relative z-10 flex flex-col items-center gap-6">
				<div
					className={cn(
						"transition-all duration-700 ease-out",
						phase === "entering" && "scale-0 opacity-0",
						phase === "visible" && "scale-100 opacity-100",
						phase === "exiting" && "scale-75 opacity-0"
					)}
					style={{ transitionDelay: phase === "visible" ? "100ms" : "0ms" }}
				>
					<div className="flex items-center justify-center size-36 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 ring-2 ring-fuchsia-400/40 text-fuchsia-300">
						<HugeiconsIcon icon={meta.icon} className="size-16" />
					</div>
				</div>

				<h1
					className={cn(
						"text-5xl sm:text-6xl font-black tracking-tighter text-center",
						"text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-fuchsia-400 to-violet-400",
						"transition-all duration-600 ease-out",
						phase === "entering" && "opacity-0 translate-y-8 scale-90",
						phase === "visible" && "opacity-100 translate-y-0 scale-100",
						phase === "exiting" && "opacity-0 -translate-y-4"
					)}
					style={{
						transitionDelay: phase === "visible" ? "250ms" : "0ms",
						textShadow: "0 0 40px rgba(217,70,239,0.5), 0 0 80px rgba(139,92,246,0.3)",
					}}
				>
					ACHIEVEMENT UNLOCKED
				</h1>

				<p
					className={cn(
						"text-xl sm:text-2xl font-bold text-white/90 text-center max-w-md",
						"transition-all duration-500",
						phase === "entering" && "opacity-0 translate-y-4",
						phase === "visible" && "opacity-100 translate-y-0",
						phase === "exiting" && "opacity-0"
					)}
					style={{ transitionDelay: phase === "visible" ? "400ms" : "0ms" }}
				>
					{currentEvent.playerName} unlocked {meta.name}
				</p>

				<div
					className={cn(
						"flex items-center gap-2 px-5 py-2.5",
						"text-sm font-bold tracking-wide uppercase",
						"bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30",
						"transition-all duration-500",
						phase === "entering" && "opacity-0 scale-75",
						phase === "visible" && "opacity-100 scale-100",
						phase === "exiting" && "opacity-0 scale-75"
					)}
					style={{ transitionDelay: phase === "visible" ? "550ms" : "0ms" }}
				>
					{meta.description}
				</div>
			</div>
		</div>
	);
}
