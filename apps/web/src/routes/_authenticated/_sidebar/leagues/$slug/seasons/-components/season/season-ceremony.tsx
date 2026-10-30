import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import {
	Add01Icon,
	ArrowLeft01Icon,
	ArrowRight01Icon,
	ChartIncreaseIcon,
	CrownIcon,
	FireIcon,
	FlashIcon,
	FullScreenIcon,
	GameController01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { formatDate } from "@coding-cowboys/scorebrawl-core/league";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FormDots } from "@/components/ui/form-dots";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CreateSeasonForm } from "../seasons/create-season-form";

type Summary = RouterOutput["season"]["getSummary"];
type PlayerRef = Summary["champions"][number];
type Standing = Summary["podium"][number];

interface SeasonInfo {
	name: string;
	startDate: Date;
	endDate: Date | null;
}

interface PodiumEntry {
	id: string;
	rank: number;
	name: string;
	score: number;
	image: string | null;
	players: { id: string; name: string; image: string | null }[];
}

type SlideSize = "wide" | "medium" | "narrow";

interface Slide {
	key: string;
	label: string;
	size: SlideSize;
	content: ReactNode;
}

const GRAIN =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const carouselWidth: Record<SlideSize, string> = {
	wide: "w-[min(84vw,440px)]",
	medium: "w-[min(84vw,330px)]",
	narrow: "w-[min(76vw,280px)]",
};

const pageSpan: Record<SlideSize, string> = {
	wide: "sm:col-span-2",
	medium: "sm:col-span-2",
	narrow: "",
};

const lgFill: Record<number, string> = {
	1: "",
	2: "lg:col-span-2",
	3: "lg:col-span-3",
	4: "lg:col-span-4",
};

const smFill: Record<number, string> = {
	1: "",
	2: "sm:col-span-2",
};

const medals = {
	1: {
		bar: "h-28 border-amber-500 from-amber-400/45 dark:from-amber-300/50",
		text: "text-amber-600 dark:text-amber-300",
	},
	2: {
		bar: "h-20 border-zinc-400 from-zinc-400/35 dark:from-zinc-300/35",
		text: "text-zinc-500 dark:text-zinc-200",
	},
	3: {
		bar: "h-14 border-orange-500 from-orange-400/40 dark:from-orange-400/45",
		text: "text-orange-600 dark:text-orange-300",
	},
} as const;

const names = (players: PlayerRef[]) => players.map((p) => p.name).join(" & ");

const record = ({ winCount, drawCount, lossCount }: Standing) =>
	drawCount > 0 ? `${winCount}-${drawCount}-${lossCount}` : `${winCount}-${lossCount}`;

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={cn(
				"text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground",
				className
			)}
		>
			{children}
		</span>
	);
}

function AvatarPair({
	players,
	size,
}: {
	players: { id: string; name: string; image: string | null }[];
	size: "sm" | "md" | "lg";
}) {
	return (
		<div className="flex gap-1">
			{players.slice(0, 2).map((p) => (
				<AvatarWithFallback key={p.id} src={p.image} name={p.name} size={size} />
			))}
		</div>
	);
}

function ChampionSlide({ summary }: { summary: Summary }) {
	const champion = summary.podium[0];
	const isTie = summary.champions.length > 1;
	if (!champion || summary.champions.length === 0) {
		return (
			<div className="flex h-full flex-col justify-center gap-3">
				<Eyebrow>Champion</Eyebrow>
				<p className="text-2xl font-black tracking-tight">No champion crowned</p>
				<p className="text-xs text-muted-foreground">No matches were played this season.</p>
			</div>
		);
	}
	const runnerUp = summary.podium.find((p) => p.score < champion.score);
	const margin = runnerUp ? champion.score - runnerUp.score : 0;

	return (
		<>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_85%_0%,rgba(245,158,11,0.26),transparent_60%)] dark:bg-[radial-gradient(120%_80%_at_85%_0%,rgba(251,191,36,0.32),transparent_60%)]" />
			<div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent motion-safe:animate-[recap-sheen_5s_ease-in-out_2s_infinite] dark:via-white/10" />
			<HugeiconsIcon
				icon={CrownIcon}
				strokeWidth={1}
				className="pointer-events-none absolute -right-8 -top-6 size-52 rotate-12 text-amber-500/[0.1] dark:text-amber-200/[0.07]"
			/>
			<div className="relative flex h-full flex-col">
				<span className="inline-flex items-center gap-1.5 self-start rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
					<HugeiconsIcon icon={CrownIcon} className="size-3" />
					{isTie ? "Co-champions" : "Champion"}
				</span>
				<div className="mt-5 flex items-center gap-4">
					{isTie ? (
						<AvatarPair players={summary.champions} size="lg" />
					) : (
						<div className="rounded-lg p-0.5 shadow-[0_0_44px_-8px_rgba(245,158,11,0.7)] ring-2 ring-amber-500/80 dark:ring-amber-300/80">
							<AvatarWithFallback src={champion.image} name={champion.name} size="xl" />
						</div>
					)}
					<div className="flex min-w-0 flex-col gap-2">
						<h3 className="line-clamp-2 text-2xl font-black leading-[1.05] tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
							{names(summary.champions)}
						</h3>
						{!isTie && champion.form.length > 0 && (
							<div className="flex items-center gap-2">
								<span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
									Form
								</span>
								<FormDots form={champion.form} />
							</div>
						)}
					</div>
				</div>
				<p className="mt-5 max-w-[34ch] text-sm leading-relaxed text-foreground/80">
					{isTie
						? `Shared the title on ${champion.score} points.`
						: runnerUp
							? `Finished ${margin} ${margin === 1 ? "point" : "points"} clear of ${runnerUp.name}.`
							: `Took the title with ${champion.score} points.`}
				</p>
				<div className="mt-auto grid grid-cols-4 divide-x divide-foreground/10 bg-muted/50 py-3 ring-1 ring-foreground/10">
					{[
						{ label: "Points", value: champion.score },
						{ label: "Record", value: record(champion) },
						{ label: "Win rate", value: `${champion.winRate}%` },
						{ label: "Matches", value: champion.matchCount },
					].map((stat) => (
						<div key={stat.label} className="flex flex-col items-center gap-1 px-1">
							<span className="text-base font-bold tabular-nums tracking-tight sm:text-lg">
								{stat.value}
							</span>
							<span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
								{stat.label}
							</span>
						</div>
					))}
				</div>
			</div>
		</>
	);
}

function PodiumSlide({ title, entries }: { title: string; entries: PodiumEntry[] }) {
	const ordered = [2, 1, 3]
		.map((rank) => entries.find((e) => e.rank === rank))
		.filter((e): e is PodiumEntry => !!e);
	return (
		<div className="relative flex h-full flex-col">
			<div className="pointer-events-none absolute -inset-5 bg-[radial-gradient(90%_60%_at_50%_100%,rgba(245,158,11,0.12),transparent_70%)]" />
			<Eyebrow>{title}</Eyebrow>
			<div className="relative mt-auto grid grid-cols-3 items-end gap-2">
				{ordered.map((entry) => {
					const medal = medals[entry.rank as 1 | 2 | 3];
					return (
						<div key={entry.id} className="flex min-w-0 flex-col items-center gap-2">
							{entry.players.length > 0 ? (
								<AvatarPair players={entry.players} size={entry.rank === 1 ? "md" : "sm"} />
							) : (
								<AvatarWithFallback
									src={entry.image}
									name={entry.name}
									size={entry.rank === 1 ? "lg" : "md"}
								/>
							)}
							<span
								className="line-clamp-2 min-h-[2.4em] w-full text-center text-[11px] font-semibold leading-tight [overflow-wrap:anywhere]"
								title={entry.name}
							>
								{entry.name}
							</span>
							<div
								className={cn(
									"flex w-full flex-col items-center justify-start border-t-2 bg-gradient-to-b to-transparent pt-2",
									medal.bar
								)}
							>
								<span className={cn("text-2xl font-black leading-none", medal.text)}>
									{entry.rank}
								</span>
								<span className="mt-1 text-[11px] font-semibold tabular-nums">{entry.score}</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

interface Tone {
	glow: string;
	icon: string;
	number: string;
}

const tones = {
	rose: {
		glow: "bg-[radial-gradient(110%_70%_at_100%_0%,rgba(244,63,94,0.18),transparent_60%)] dark:bg-[radial-gradient(110%_70%_at_100%_0%,rgba(248,113,113,0.26),transparent_60%)]",
		icon: "text-rose-600 dark:text-rose-300",
		number: "to-rose-500 dark:to-rose-300",
	},
	violet: {
		glow: "bg-[radial-gradient(110%_70%_at_100%_0%,rgba(139,92,246,0.18),transparent_60%)] dark:bg-[radial-gradient(110%_70%_at_100%_0%,rgba(192,132,252,0.28),transparent_60%)]",
		icon: "text-violet-600 dark:text-violet-300",
		number: "to-violet-500 dark:to-violet-300",
	},
	emerald: {
		glow: "bg-[radial-gradient(110%_70%_at_100%_0%,rgba(16,185,129,0.18),transparent_60%)] dark:bg-[radial-gradient(110%_70%_at_100%_0%,rgba(52,211,153,0.24),transparent_60%)]",
		icon: "text-emerald-600 dark:text-emerald-300",
		number: "to-emerald-500 dark:to-emerald-300",
	},
	sky: {
		glow: "bg-[radial-gradient(110%_70%_at_100%_0%,rgba(14,165,233,0.18),transparent_60%)] dark:bg-[radial-gradient(110%_70%_at_100%_0%,rgba(96,165,250,0.26),transparent_60%)]",
		icon: "text-sky-600 dark:text-sky-300",
		number: "to-sky-500 dark:to-sky-300",
	},
} satisfies Record<string, Tone>;

function MomentSlide({
	label,
	icon,
	tone,
	value,
	unit,
	players,
	caption,
	detail,
}: {
	label: string;
	icon: IconSvgElement;
	tone: Tone;
	value: string;
	unit: string;
	players: PlayerRef[];
	caption: string;
	detail?: string;
}) {
	return (
		<>
			<div className={cn("pointer-events-none absolute inset-0", tone.glow)} />
			<HugeiconsIcon
				icon={icon}
				strokeWidth={1}
				className={cn(
					"pointer-events-none absolute -bottom-6 -right-6 size-40 -rotate-12 opacity-[0.08]",
					tone.icon
				)}
			/>
			<div className="relative flex h-full flex-col">
				<div className="flex items-center justify-between">
					<Eyebrow>{label}</Eyebrow>
					<HugeiconsIcon icon={icon} className={cn("size-4", tone.icon)} />
				</div>
				<div className="mt-6 flex flex-col">
					<span
						className={cn(
							"bg-gradient-to-br from-foreground bg-clip-text text-7xl font-black leading-none tracking-tighter text-transparent tabular-nums",
							tone.number
						)}
					>
						{value}
					</span>
					<span className="mt-2 text-xs text-muted-foreground">{unit}</span>
				</div>
				<div className="mt-auto flex items-center gap-3 border-t border-foreground/10 pt-4">
					<AvatarPair players={players} size="sm" />
					<div className="flex min-w-0 flex-col">
						<span className="line-clamp-2 text-xs font-semibold leading-snug" title={caption}>
							{caption}
						</span>
						{detail && (
							<span
								className="line-clamp-2 text-[11px] leading-snug text-muted-foreground"
								title={detail}
							>
								{detail}
							</span>
						)}
					</div>
				</div>
			</div>
		</>
	);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function NumbersSlide({ summary, season }: { summary: Summary; season: SeasonInfo }) {
	const [champion, runnerUp] = summary.podium;
	const rows: { label: string; value: string | number }[] = [
		{ label: "Matches played", value: summary.matchCount },
		{ label: "Players", value: summary.playerCount },
	];
	if (champion && runnerUp) {
		rows.push({ label: "Title decided by", value: `${champion.score - runnerUp.score} pts` });
	}
	if (season.endDate) {
		const days = Math.max(
			1,
			Math.round(
				(new Date(season.endDate).getTime() - new Date(season.startDate).getTime()) / DAY_MS
			)
		);
		rows.push({ label: "Season length", value: `${days} ${days === 1 ? "day" : "days"}` });
	}
	return (
		<>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_70%_at_0%_100%,rgba(14,165,233,0.14),transparent_65%)] dark:bg-[radial-gradient(100%_70%_at_0%_100%,rgba(56,189,248,0.18),transparent_65%)]" />
			<div className="relative flex h-full flex-col">
				<Eyebrow>By the numbers</Eyebrow>
				<div className="mt-auto flex flex-col divide-y divide-foreground/10">
					{rows.map((row) => (
						<div key={row.label} className="flex items-baseline justify-between gap-3 py-3">
							<span className="text-xs text-muted-foreground">{row.label}</span>
							<span className="text-2xl font-black tabular-nums tracking-tight">{row.value}</span>
						</div>
					))}
				</div>
			</div>
		</>
	);
}

function buildSlides(summary: Summary, season: SeasonInfo): Slide[] {
	const slides: Slide[] = [
		{
			key: "champion",
			label: "Champion",
			size: "wide",
			content: <ChampionSlide summary={summary} />,
		},
	];
	if (summary.matchCount === 0) return slides;

	slides.push({
		key: "podium",
		label: "Player podium",
		size: "medium",
		content: (
			<PodiumSlide
				title="Player podium"
				entries={summary.podium.map((p) => ({ ...p, players: [] }))}
			/>
		),
	});
	if (summary.teamPodium.length > 0) {
		slides.push({
			key: "team-podium",
			label: "Team podium",
			size: "medium",
			content: (
				<PodiumSlide
					title="Team podium"
					entries={summary.teamPodium.map((t) => ({ ...t, image: t.logo }))}
				/>
			),
		});
	}

	const { longestWinStreak, biggestUpset, biggestGain, mostMatches } = summary.highlights;
	if (longestWinStreak) {
		slides.push({
			key: "streak",
			label: "Longest streak",
			size: "narrow",
			content: (
				<MomentSlide
					label="Longest streak"
					icon={FireIcon}
					tone={tones.rose}
					value={String(longestWinStreak.length)}
					unit="wins in a row"
					players={[longestWinStreak.player]}
					caption={longestWinStreak.player.name}
				/>
			),
		});
	}
	if (biggestUpset) {
		slides.push({
			key: "upset",
			label: "Biggest upset",
			size: "narrow",
			content: (
				<MomentSlide
					label="Biggest upset"
					icon={FlashIcon}
					tone={tones.violet}
					value={`${Math.round(biggestUpset.winnerOdds * 100)}%`}
					unit="chance to win — and they did"
					players={biggestUpset.winners}
					caption={names(biggestUpset.winners)}
					detail={`${biggestUpset.winnerScore}–${biggestUpset.loserScore} vs ${names(biggestUpset.losers)}`}
				/>
			),
		});
	}
	if (biggestGain) {
		slides.push({
			key: "gain",
			label: "Biggest swing",
			size: "narrow",
			content: (
				<MomentSlide
					label="Biggest swing"
					icon={ChartIncreaseIcon}
					tone={tones.emerald}
					value={`+${biggestGain.gain}`}
					unit="points in a single match"
					players={[biggestGain.player]}
					caption={biggestGain.player.name}
				/>
			),
		});
	}
	if (mostMatches) {
		slides.push({
			key: "matches",
			label: "Iron player",
			size: "narrow",
			content: (
				<MomentSlide
					label="Iron player"
					icon={GameController01Icon}
					tone={tones.sky}
					value={String(mostMatches.matchCount)}
					unit="matches played"
					players={[mostMatches.player]}
					caption={mostMatches.player.name}
				/>
			),
		});
	}
	slides.push({
		key: "numbers",
		label: "By the numbers",
		size: "narrow",
		content: <NumbersSlide summary={summary} season={season} />,
	});
	return slides;
}

function pageSpanFor(slides: Slide[], index: number) {
	const slide = slides[index];
	if (index !== slides.length - 1) return pageSpan[slide.size];
	const columnsUsed = (perRow: number) =>
		slides
			.slice(0, index)
			.reduce((sum, s) => sum + (s.size === "narrow" ? 1 : Math.min(2, perRow)), 0) % perRow;
	return cn(smFill[2 - columnsUsed(2)], lgFill[4 - columnsUsed(4)]);
}

function useCarousel(count: number) {
	const trackRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(0);
	const [edges, setEdges] = useState({ start: true, end: count <= 1 });

	const slideOffset = useCallback((track: HTMLDivElement, slide: HTMLElement) => {
		const origin =
			track.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(track).paddingLeft);
		return slide.getBoundingClientRect().left - origin;
	}, []);

	const measure = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		const slides = Array.from(track.querySelectorAll<HTMLElement>("[data-slide]"));
		const distances = slides.map((slide) => Math.abs(slideOffset(track, slide)));
		const nearest = distances.indexOf(Math.min(...distances));
		const left = track.scrollLeft;
		const atEnd = left + track.clientWidth >= track.scrollWidth - 4;
		setActive(atEnd ? slides.length - 1 : Math.max(0, nearest));
		setEdges({ start: left <= 4, end: atEnd });
	}, [slideOffset]);

	useEffect(() => {
		const track = trackRef.current;
		if (!track) return;
		measure();
		track.addEventListener("scroll", measure, { passive: true });
		window.addEventListener("resize", measure);
		return () => {
			track.removeEventListener("scroll", measure);
			window.removeEventListener("resize", measure);
		};
	}, [measure, count]);

	const goTo = useCallback(
		(index: number) => {
			const track = trackRef.current;
			const slide = track?.querySelectorAll<HTMLElement>("[data-slide]")[index];
			if (!track || !slide) return;
			track.scrollTo({ left: track.scrollLeft + slideOffset(track, slide), behavior: "smooth" });
		},
		[slideOffset]
	);

	return { trackRef, active, edges, goTo };
}

function Backdrop() {
	return (
		<>
			<div className="pointer-events-none absolute -top-48 left-[20%] -z-10 size-[560px] rounded-full bg-amber-400/20 blur-[130px] dark:bg-amber-500/25" />
			<div className="pointer-events-none absolute -bottom-56 right-[-10%] -z-10 size-[520px] rounded-full bg-fuchsia-500/10 blur-[130px] dark:bg-fuchsia-600/20" />
			<div className="pointer-events-none absolute -left-32 top-1/3 -z-10 size-[380px] rounded-full bg-sky-400/10 blur-[110px]" />
			<div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
			<div
				className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mix-blend-overlay dark:opacity-[0.07]"
				style={{ backgroundImage: GRAIN }}
			/>
		</>
	);
}

function RecapHeader({
	season,
	summary,
	actions,
	large,
}: {
	season: SeasonInfo;
	summary: Summary;
	actions: ReactNode;
	large?: boolean;
}) {
	const dateRange = `${formatDate(season.startDate)}${season.endDate ? ` – ${formatDate(season.endDate)}` : ""}`;
	return (
		<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div className="flex min-w-0 flex-col gap-2">
				<div className="flex items-center gap-2">
					<span className="relative flex size-2">
						<span className="absolute inline-flex size-full rounded-full bg-amber-500 opacity-60 motion-safe:animate-ping" />
						<span className="relative inline-flex size-2 rounded-full bg-amber-500" />
					</span>
					<Eyebrow className="text-amber-600 dark:text-amber-300">Season recap</Eyebrow>
				</div>
				<h2
					className={cn(
						"font-black leading-none tracking-tighter [overflow-wrap:anywhere]",
						large ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl"
					)}
				>
					{season.name}
				</h2>
				<p className="text-xs text-muted-foreground">
					{dateRange}
					<span className="mx-2 text-foreground/25">/</span>
					{summary.matchCount} matches
					<span className="mx-2 text-foreground/25">/</span>
					{summary.playerCount} players
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">{actions}</div>
		</header>
	);
}

const slideBase =
	"relative flex h-[340px] flex-col overflow-hidden bg-background/70 p-5 ring-1 ring-foreground/10 backdrop-blur-sm transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:ring-foreground/20 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-700 motion-safe:fill-mode-both";

export function SeasonCeremony({
	seasonSlug,
	season,
	leagueSlug,
	canStartNextSeason,
	isFullScreen,
	onFullScreenChange,
}: {
	seasonSlug: string;
	season: SeasonInfo;
	leagueSlug: string;
	canStartNextSeason: boolean;
	isFullScreen: boolean;
	onFullScreenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));
	const slides = summary ? buildSlides(summary, season) : [];
	const { trackRef, active, edges, goTo } = useCarousel(slides.length);

	if (!summary) return <Skeleton className="h-[520px] w-full" />;

	const startNextSeason = canStartNextSeason && (
		<GlowButton
			icon={Add01Icon}
			glowColor={glowColors.amber}
			size="sm"
			className="gap-1.5"
			onClick={() => setIsCreateOpen(true)}
			data-testid="start-next-season-button"
		>
			Start next season
		</GlowButton>
	);

	return (
		<>
			<section
				className="relative isolate w-full overflow-clip bg-card text-card-foreground ring-1 ring-foreground/10 [contain:inline-size]"
				data-testid="season-ceremony"
				aria-label={`${season.name} recap`}
			>
				<Backdrop />
				<div className="px-5 pt-6 sm:px-7 sm:pt-7">
					<RecapHeader
						season={season}
						summary={summary}
						actions={
							<>
								{startNextSeason}
								<Button
									variant="outline"
									size="sm"
									className="gap-1.5"
									onClick={() => onFullScreenChange(true)}
									data-testid="recap-full-screen-button"
								>
									<HugeiconsIcon icon={FullScreenIcon} className="size-3.5" />
									Full screen
								</Button>
								{slides.length > 1 && (
									<div className="hidden items-center gap-1 sm:flex">
										<Button
											variant="outline"
											size="icon-sm"
											aria-label="Previous slide"
											disabled={edges.start}
											onClick={() => goTo(Math.max(0, active - 1))}
										>
											<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
										</Button>
										<Button
											variant="outline"
											size="icon-sm"
											aria-label="Next slide"
											disabled={edges.end}
											onClick={() => goTo(Math.min(slides.length - 1, active + 1))}
										>
											<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
										</Button>
									</div>
								)}
							</>
						}
					/>
				</div>

				<div
					ref={trackRef}
					tabIndex={0}
					role="region"
					aria-roledescription="carousel"
					aria-label={`${season.name} highlights`}
					className="mt-4 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overscroll-x-contain px-5 pt-2 pb-2 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] [scrollbar-width:none] focus-visible:outline-none sm:scroll-px-7 sm:px-7 [&::-webkit-scrollbar]:hidden"
				>
					{slides.map((slide, index) => (
						<article
							key={slide.key}
							data-slide
							role="group"
							aria-roledescription="slide"
							aria-label={`${index + 1} of ${slides.length}: ${slide.label}`}
							style={{ animationDelay: `${index * 70}ms` } as CSSProperties}
							className={cn(
								slideBase,
								"shrink-0 snap-start motion-safe:slide-in-from-right-8",
								carouselWidth[slide.size]
							)}
						>
							{slide.content}
						</article>
					))}
					<div aria-hidden className="w-1 shrink-0" />
				</div>

				<div className="flex items-center gap-1.5 px-5 pb-6 pt-4 sm:px-7">
					{slides.map((slide, index) => (
						<button
							key={slide.key}
							type="button"
							aria-label={`Go to ${slide.label}`}
							aria-current={index === active}
							onClick={() => goTo(index)}
							className="group/dot flex h-4 flex-1 items-center focus-visible:outline-none"
						>
							<span
								className={cn(
									"h-[3px] w-full transition-colors duration-300 group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-ring",
									index === active
										? "bg-amber-500"
										: index < active
											? "bg-foreground/40"
											: "bg-foreground/15 group-hover/dot:bg-foreground/30"
								)}
							/>
						</button>
					))}
				</div>
			</section>

			<Dialog open={isFullScreen} onOpenChange={onFullScreenChange}>
				<DialogContent
					className="top-0 left-0 block h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto bg-card p-0 ring-0 sm:max-w-none"
					data-testid="season-recap-full-screen"
				>
					<div className="relative isolate min-h-full overflow-clip">
						<Backdrop />
						<div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-10 sm:py-14">
							<DialogTitle className="sr-only">{`${season.name} recap`}</DialogTitle>
							<RecapHeader season={season} summary={summary} actions={startNextSeason} large />
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
								{slides.map((slide, index) => (
									<article
										key={slide.key}
										aria-label={slide.label}
										style={{ animationDelay: `${index * 60}ms` } as CSSProperties}
										className={cn(
											slideBase,
											"motion-safe:slide-in-from-bottom-4",
											pageSpanFor(slides, index)
										)}
									>
										{slide.content}
									</article>
								))}
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{canStartNextSeason && (
				<CreateSeasonForm
					isOpen={isCreateOpen}
					onClose={() => setIsCreateOpen(false)}
					onSuccess={(newSeasonSlug) => {
						onFullScreenChange(false);
						void navigate({
							to: "/leagues/$slug/seasons/$seasonSlug",
							params: { slug: leagueSlug, seasonSlug: newSeasonSlug },
						});
					}}
				/>
			)}
		</>
	);
}
