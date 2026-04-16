import { useEffect, useState, useCallback, useRef } from "react";
import { StreakAvatar } from "./streak-avatar";
import { cn } from "@/lib/utils";

export interface StreakFlyoutEvent {
	playerId: string;
	playerName: string;
	playerImage?: string | null;
	streak: number;
	timestamp: number;
	eventId?: string;
	isTeam?: boolean;
}

const FIRE_TITLES_5 = ["ON FIRE", "UNSTOPPABLE", "BLAZING", "SCORCHING", "INFERNO"];
const FIRE_TITLES_10 = ["RAMPAGE", "LEGENDARY", "SUPERNOVA", "APOCALYPSE", "GODLIKE"];
const FIRE_TITLES_15 = [
	"TRANSCENDENT",
	"BEYOND GODLIKE",
	"UNHOLY",
	"COSMIC DESTRUCTION",
	"UNIVERSAL DOMINATION",
];

const ICE_TITLES_5 = ["FROZEN", "ICE COLD", "GLACIAL", "FROSTBITTEN", "DEEP FREEZE"];
const ICE_TITLES_10 = [
	"SUB-ZERO",
	"ARCTIC DEATH",
	"ABSOLUTE ZERO",
	"POLAR VORTEX",
	"HELL FROZE OVER",
];
const ICE_TITLES_15 = [
	"ENTROPY",
	"HEAT DEATH",
	"EXTINCTION EVENT",
	"ETERNAL WINTER",
	"DEATH ITSELF",
];

const FIRE_SUBTITLES_5 = [
	"{} is on a rampage!",
	"{} can't be stopped!",
	"{} is burning the competition!",
	"{} is absolutely on fire!",
	"{} is dominating!",
];
const FIRE_SUBTITLES_10 = [
	"{} has ascended to a higher plane!",
	"The gods themselves fear {}!",
	"{} is breaking reality itself!",
	"Mortals cannot comprehend {}'s power!",
	"{} has become legend!",
];
const FIRE_SUBTITLES_15 = [
	"{} has transcended mortal limits!",
	"The universe trembles before {}!",
	"{} exists beyond time and space!",
	"Reality is shattering around {}!",
	"{} has achieved true omnipotence!",
];

const ICE_SUBTITLES_5 = [
	"{} is struggling hard!",
	"{} needs to warm up!",
	"{} is on thin ice!",
	"{} can't buy a win!",
	"{} is frozen solid!",
];
const ICE_SUBTITLES_10 = [
	"{} has forgotten what winning feels like!",
	"Victory and {} are no longer on speaking terms!",
	"{} is considering a career in interpretive dance!",
	"Hope is a foreign concept to {}!",
	"{}'s controller is filing for emotional damages!",
];
const ICE_SUBTITLES_15 = [
	"{} is the reason therapists charge extra!",
	"Even their shadow quit and got a new job!",
	"{}'s losing streak has its own losing streak!",
	"Statisticians use {} as a cautionary tale!",
	"{} has achieved the mathematical impossibility of negative skill!",
];

// Team-specific subtitles (plural/they versions)
const TEAM_FIRE_SUBTITLES_5 = [
	"{} are on a rampage!",
	"{} can't be stopped!",
	"{} are burning the competition!",
	"{} are absolutely on fire!",
	"{} are dominating!",
];
const TEAM_FIRE_SUBTITLES_10 = [
	"{} have ascended to a higher plane!",
	"The gods themselves fear {}!",
	"{} are breaking reality itself!",
	"Mortals cannot comprehend {}'s power!",
	"{} have become legend!",
];
const TEAM_FIRE_SUBTITLES_15 = [
	"{} have transcended mortal limits!",
	"The universe trembles before {}!",
	"{} exist beyond time and space!",
	"Reality is shattering around {}!",
	"{} have achieved true omnipotence!",
];

const TEAM_ICE_SUBTITLES_5 = [
	"{} are struggling hard!",
	"{} need to warm up!",
	"{} are on thin ice!",
	"{} can't buy a win!",
	"{} are frozen solid!",
];
const TEAM_ICE_SUBTITLES_10 = [
	"{} have forgotten what winning feels like!",
	"Victory and {} are no longer on speaking terms!",
	"{} are considering a career in interpretive dance!",
	"Hope is a foreign concept to {}!",
	"{}'s controllers are filing for emotional damages!",
];
const TEAM_ICE_SUBTITLES_15 = [
	"{} are the reason therapists charge extra!",
	"Even their shadows quit and got new jobs!",
	"{}'s losing streak has its own losing streak!",
	"Statisticians use {} as a cautionary tale!",
	"{} have achieved the mathematical impossibility of negative skill!",
];

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function getEventId(event: StreakFlyoutEvent): string {
	return event.eventId || `${event.playerId}-${event.timestamp}`;
}

function getShownEvents(): Set<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const stored = sessionStorage.getItem("streak-events-shown");
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
		sessionStorage.setItem("streak-events-shown", JSON.stringify(arr));
	} catch {
		// ignore
	}
}

const PARTICLE_COUNT = 24;

function Particles({ isFire }: { isFire: boolean }) {
	const particles = useRef(
		Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
			id: i,
			x: Math.random() * 100,
			y: Math.random() * 100,
			size: 2 + Math.random() * 4,
			delay: Math.random() * 3,
			duration: 2 + Math.random() * 3,
			drift: -20 + Math.random() * 40,
		}))
	).current;

	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
			{particles.map((p) => (
				<div
					key={p.id}
					className={cn("absolute rounded-full", isFire ? "bg-orange-400" : "bg-cyan-300")}
					style={{
						left: `${p.x}%`,
						top: `${p.y}%`,
						width: p.size,
						height: p.size,
						opacity: 0,
						animation: `streak-particle ${p.duration}s ease-in-out ${p.delay}s infinite`,
						["--drift" as string]: `${p.drift}px`,
					}}
				/>
			))}
		</div>
	);
}

function RadialBurst({ isFire }: { isFire: boolean }) {
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
					className={cn(
						"absolute w-px origin-bottom",
						isFire
							? "bg-gradient-to-t from-orange-500/60 to-transparent"
							: "bg-gradient-to-t from-cyan-400/60 to-transparent"
					)}
					style={
						{
							height: "40vh",
							"--angle": `${l.angle}deg`,
							opacity: 0,
							animation: `streak-burst 0.8s ease-out ${l.delay}s forwards`,
						} as React.CSSProperties
					}
				/>
			))}
		</div>
	);
}

type Phase = "hidden" | "entering" | "visible" | "exiting";

export function StreakFlyout() {
	const [currentEvent, setCurrentEvent] = useState<StreakFlyoutEvent | null>(null);
	const [phase, setPhase] = useState<Phase>("hidden");
	const [title, setTitle] = useState("");
	const [subtitle, setSubtitle] = useState("");
	const eventQueue = useRef<StreakFlyoutEvent[]>([]);
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

		const isFire = next.streak > 0;
		const streakMagnitude = Math.abs(next.streak);
		const isTeam = next.isTeam ?? false;
		let titles: string[];
		let subtitles: string[];
		if (streakMagnitude >= 15) {
			titles = isFire ? FIRE_TITLES_15 : ICE_TITLES_15;
			subtitles = isFire
				? isTeam
					? TEAM_FIRE_SUBTITLES_15
					: FIRE_SUBTITLES_15
				: isTeam
					? TEAM_ICE_SUBTITLES_15
					: ICE_SUBTITLES_15;
		} else if (streakMagnitude >= 10) {
			titles = isFire ? FIRE_TITLES_10 : ICE_TITLES_10;
			subtitles = isFire
				? isTeam
					? TEAM_FIRE_SUBTITLES_10
					: FIRE_SUBTITLES_10
				: isTeam
					? TEAM_ICE_SUBTITLES_10
					: ICE_SUBTITLES_10;
		} else {
			titles = isFire ? FIRE_TITLES_5 : ICE_TITLES_5;
			subtitles = isFire
				? isTeam
					? TEAM_FIRE_SUBTITLES_5
					: FIRE_SUBTITLES_5
				: isTeam
					? TEAM_ICE_SUBTITLES_5
					: ICE_SUBTITLES_5;
		}
		setTitle(pick(titles));
		setSubtitle(pick(subtitles).replace("{}", next.playerName));
		setCurrentEvent(next);
		setPhase("entering");

		canDismiss.current = false;
		clearTimers();
		const skipDelay = eventQueue.current.length > 0 ? 0 : 1000;
		timers.current.push(
			setTimeout(() => {
				setPhase("visible");
				timers.current.push(
					setTimeout(() => {
						canDismiss.current = true;
					}, skipDelay)
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

	const queueEvent = useCallback((event: StreakFlyoutEvent) => {
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
			const detail = (e as CustomEvent<StreakFlyoutEvent>).detail;
			if (detail?.playerId) queueEvent(detail);
		};

		window.addEventListener("streak-event", handler);
		return () => window.removeEventListener("streak-event", handler);
	}, [queueEvent]);

	if (!currentEvent || phase === "hidden") return null;

	const isFire = currentEvent.streak > 0;
	const streakCount = Math.abs(currentEvent.streak);

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
			<div
				className={cn(
					"absolute inset-0",
					isFire
						? "bg-gradient-to-b from-black via-red-950/90 to-black"
						: "bg-gradient-to-b from-black via-blue-950/90 to-black"
				)}
			/>

			{/* Vignette */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,black_80%)]" />

			{/* Radial burst lines */}
			{phase !== "exiting" && <RadialBurst isFire={isFire} />}

			{/* Floating particles */}
			<Particles isFire={isFire} />

			{/* Ring pulse behind avatar */}
			<div
				className={cn(
					"absolute rounded-full",
					isFire
						? "bg-orange-500/10 shadow-[0_0_120px_60px_rgba(255,100,0,0.15)]"
						: "bg-cyan-500/10 shadow-[0_0_120px_60px_rgba(0,180,255,0.15)]",
					"transition-all duration-700",
					phase === "entering" && "scale-0 opacity-0",
					phase === "visible" && "scale-100 opacity-100",
					phase === "exiting" && "scale-150 opacity-0"
				)}
				style={{ width: 280, height: 280 }}
			/>

			{/* Content */}
			<div className="relative z-10 flex flex-col items-center gap-6">
				{/* Avatar */}
				<div
					className={cn(
						"transition-all duration-700 ease-out",
						phase === "entering" && "scale-0 opacity-0",
						phase === "visible" && "scale-100 opacity-100",
						phase === "exiting" && "scale-75 opacity-0"
					)}
					style={{ transitionDelay: phase === "visible" ? "100ms" : "0ms" }}
				>
					<StreakAvatar
						src={currentEvent.playerImage}
						name={currentEvent.playerName}
						streak={currentEvent.streak}
						size={140}
					/>
				</div>

				{/* Title */}
				<h1
					className={cn(
						"text-5xl sm:text-7xl font-black tracking-tighter text-center",
						"transition-all duration-600 ease-out",
						isFire
							? "text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500"
							: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-blue-300 to-indigo-400",
						phase === "entering" && "opacity-0 translate-y-8 scale-90",
						phase === "visible" && "opacity-100 translate-y-0 scale-100",
						phase === "exiting" && "opacity-0 -translate-y-4"
					)}
					style={{
						transitionDelay: phase === "visible" ? "250ms" : "0ms",
						textShadow: isFire
							? "0 0 40px rgba(255,100,0,0.5), 0 0 80px rgba(255,50,0,0.3)"
							: "0 0 40px rgba(0,150,255,0.5), 0 0 80px rgba(0,100,255,0.3)",
					}}
				>
					{title}
				</h1>

				{/* Player name */}
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
					{subtitle}
				</p>

				{/* Streak badge */}
				<div
					className={cn(
						"flex items-center gap-2 px-5 py-2.5",
						"text-sm font-bold tracking-wide uppercase",
						isFire
							? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30"
							: "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30",
						"transition-all duration-500",
						phase === "entering" && "opacity-0 scale-75",
						phase === "visible" && "opacity-100 scale-100",
						phase === "exiting" && "opacity-0 scale-75"
					)}
					style={{ transitionDelay: phase === "visible" ? "550ms" : "0ms" }}
				>
					{streakCount} game {isFire ? "win" : "loss"} streak
				</div>
			</div>
		</div>
	);
}

export function triggerStreakFlyout(event: Omit<StreakFlyoutEvent, "timestamp">) {
	window.dispatchEvent(
		new CustomEvent("streak-event", {
			detail: { ...event, timestamp: Date.now() },
		})
	);
}
