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
	GameController01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { formatDate } from "@coding-cowboys/scorebrawl-core/league";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { FormDots } from "@/components/ui/form-dots";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CreateSeasonForm } from "../seasons/create-season-form";

type Summary = RouterOutput["season"]["getSummary"];
type PlayerRef = Summary["champions"][number];
type Standing = Summary["podium"][number];

interface PodiumEntry {
	id: string;
	rank: number;
	name: string;
	score: number;
	image: string | null;
	players: { id: string; name: string; image: string | null }[];
}

interface SeasonInfo {
	name: string;
	startDate: Date;
	endDate: Date | null;
}

interface Slide {
	key: string;
	label: string;
	width: "wide" | "medium" | "narrow";
	content: ReactNode;
}

const GRAIN =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const medals = {
	1: {
		bar: "h-28 from-amber-300/70 via-amber-400/25 to-amber-500/0 border-amber-300/70",
		text: "text-amber-200",
	},
	2: {
		bar: "h-20 from-zinc-200/50 via-zinc-300/15 to-zinc-400/0 border-zinc-200/60",
		text: "text-zinc-200",
	},
	3: {
		bar: "h-14 from-orange-400/55 via-orange-500/15 to-orange-600/0 border-orange-400/60",
		text: "text-orange-200",
	},
} as const;

const slideWidth = {
	wide: "w-[min(84vw,440px)]",
	medium: "w-[min(84vw,330px)]",
	narrow: "w-[min(76vw,280px)]",
} as const;

const names = (players: PlayerRef[]) => players.map((p) => p.name).join(" & ");

const record = ({ winCount, drawCount, lossCount }: Standing) =>
	drawCount > 0 ? `${winCount}-${drawCount}-${lossCount}` : `${winCount}-${lossCount}`;

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={cn(
				"text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400",
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
				<div key={p.id} className="rounded-lg">
					<AvatarWithFallback src={p.image} name={p.name} size={size} />
				</div>
			))}
		</div>
	);
}

function ChampionSlide({ summary }: { summary: Summary }) {
	const champion = summary.podium[0];
	const runnerUp = summary.podium.find((p) => p.score < (champion?.score ?? 0));
	const isTie = summary.champions.length > 1;
	if (!champion || summary.champions.length === 0) {
		return (
			<div className="flex h-full flex-col justify-center gap-3">
				<Eyebrow>Champion</Eyebrow>
				<p className="text-2xl font-black tracking-tight">No champion crowned</p>
				<p className="text-xs text-zinc-400">No matches were played this season.</p>
			</div>
		);
	}
	return (
		<>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_85%_0%,rgba(251,191,36,0.38),transparent_60%)]" />
			<div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent motion-safe:animate-[recap-sheen_5s_ease-in-out_2s_infinite]" />
			<HugeiconsIcon
				icon={CrownIcon}
				strokeWidth={1}
				className="pointer-events-none absolute -right-8 -top-6 size-52 rotate-12 text-amber-200/[0.07]"
			/>
			<div className="relative flex h-full flex-col">
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200 ring-1 ring-amber-300/30">
						<HugeiconsIcon icon={CrownIcon} className="size-3" />
						{isTie ? "Co-champions" : "Champion"}
					</span>
				</div>
				<div className="mt-5 flex items-center gap-4">
					{isTie ? (
						<AvatarPair players={summary.champions} size="lg" />
					) : (
						<div className="rounded-xl p-0.5 shadow-[0_0_48px_-6px_rgba(251,191,36,0.65)] ring-2 ring-amber-300/80">
							<AvatarWithFallback src={champion.image} name={champion.name} size="xl" />
						</div>
					)}
					<div className="flex min-w-0 flex-col gap-2">
						<h3 className="line-clamp-2 text-2xl font-black leading-[1.05] tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
							{names(summary.champions)}
						</h3>
						{!isTie && champion.form.length > 0 && (
							<div className="flex items-center gap-2">
								<span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Form</span>
								<FormDots form={champion.form} />
							</div>
						)}
					</div>
				</div>
				<p className="mt-5 max-w-[34ch] text-sm leading-relaxed text-zinc-300">
					{isTie
						? `Shared the title on ${champion.score} points.`
						: runnerUp
							? `Finished ${champion.score - runnerUp.score} ${champion.score - runnerUp.score === 1 ? "point" : "points"} clear of ${runnerUp.name}.`
							: `Took the title with ${champion.score} points.`}
				</p>
				<div className="mt-auto grid grid-cols-4 divide-x divide-white/10 rounded-xl bg-white/[0.04] py-3 ring-1 ring-white/10">
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
							<span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
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
			<div className="pointer-events-none absolute -inset-5 bg-[radial-gradient(90%_60%_at_50%_100%,rgba(251,191,36,0.14),transparent_70%)]" />
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
								className="line-clamp-2 min-h-[2.4em] w-full text-center text-[11px] font-semibold leading-tight text-zinc-100 [overflow-wrap:anywhere]"
								title={entry.name}
							>
								{entry.name}
							</span>
							<div
								className={cn(
									"flex w-full flex-col items-center justify-start rounded-t-lg border-t-2 bg-gradient-to-b pt-2",
									medal.bar
								)}
							>
								<span className={cn("text-2xl font-black leading-none", medal.text)}>
									{entry.rank}
								</span>
								<span className="mt-1 text-[11px] font-semibold tabular-nums text-zinc-200">
									{entry.score}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function MomentSlide({
	label,
	icon,
	glow,
	accent,
	gradient,
	value,
	unit,
	players,
	caption,
	detail,
}: {
	label: string;
	icon: IconSvgElement;
	glow: string;
	accent: string;
	gradient: string;
	value: string;
	unit: string;
	players: PlayerRef[];
	caption: string;
	detail?: string;
}) {
	return (
		<>
			<div className={cn("pointer-events-none absolute inset-0", glow)} />
			<HugeiconsIcon
				icon={icon}
				strokeWidth={1}
				className={cn(
					"pointer-events-none absolute -bottom-6 -right-6 size-40 -rotate-12 opacity-[0.07]",
					accent
				)}
			/>
			<div className="relative flex h-full flex-col">
				<div className="flex items-center justify-between">
					<Eyebrow>{label}</Eyebrow>
					<span
						className={cn(
							"flex size-8 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10",
							accent
						)}
					>
						<HugeiconsIcon icon={icon} className="size-4" />
					</span>
				</div>
				<div className="mt-6 flex flex-col">
					<span
						className={cn(
							"bg-gradient-to-br from-white bg-clip-text text-7xl font-black leading-none tracking-tighter text-transparent tabular-nums",
							gradient
						)}
					>
						{value}
					</span>
					<span className="mt-2 text-xs text-zinc-400">{unit}</span>
				</div>
				<div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-4">
					<AvatarPair players={players} size="sm" />
					<div className="flex min-w-0 flex-col">
						<span
							className="line-clamp-2 text-xs font-semibold leading-snug text-zinc-100"
							title={caption}
						>
							{caption}
						</span>
						{detail && (
							<span className="line-clamp-2 text-[11px] leading-snug text-zinc-500" title={detail}>
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
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_70%_at_0%_100%,rgba(56,189,248,0.18),transparent_65%)]" />
			<div className="relative flex h-full flex-col">
				<Eyebrow>By the numbers</Eyebrow>
				<div className="mt-auto flex flex-col divide-y divide-white/10">
					{rows.map((row) => (
						<div key={row.label} className="flex items-baseline justify-between gap-3 py-3">
							<span className="text-xs text-zinc-400">{row.label}</span>
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
			width: "wide",
			content: <ChampionSlide summary={summary} />,
		},
	];
	if (summary.matchCount === 0) return slides;

	slides.push({
		key: "podium",
		label: "Player podium",
		width: "medium",
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
			width: "medium",
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
			width: "narrow",
			content: (
				<MomentSlide
					label="Longest streak"
					icon={FireIcon}
					glow="bg-[radial-gradient(110%_70%_at_100%_0%,rgba(248,113,113,0.28),transparent_60%)]"
					accent="text-rose-300"
					gradient="to-rose-300"
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
			width: "narrow",
			content: (
				<MomentSlide
					label="Biggest upset"
					icon={FlashIcon}
					glow="bg-[radial-gradient(110%_70%_at_100%_0%,rgba(192,132,252,0.3),transparent_60%)]"
					accent="text-violet-300"
					gradient="to-violet-300"
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
			width: "narrow",
			content: (
				<MomentSlide
					label="Biggest swing"
					icon={ChartIncreaseIcon}
					glow="bg-[radial-gradient(110%_70%_at_100%_0%,rgba(52,211,153,0.26),transparent_60%)]"
					accent="text-emerald-300"
					gradient="to-emerald-300"
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
			width: "narrow",
			content: (
				<MomentSlide
					label="Iron player"
					icon={GameController01Icon}
					glow="bg-[radial-gradient(110%_70%_at_100%_0%,rgba(96,165,250,0.28),transparent_60%)]"
					accent="text-sky-300"
					gradient="to-sky-300"
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
		width: "narrow",
		content: <NumbersSlide summary={summary} season={season} />,
	});
	return slides;
}

function useCarousel(count: number) {
	const trackRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(0);
	const [edges, setEdges] = useState({ start: true, end: count <= 1 });

	const measure = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		const slides = Array.from(track.querySelectorAll<HTMLElement>("[data-slide]"));
		const origin =
			track.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(track).paddingLeft);
		const distances = slides.map((slide) => Math.abs(slide.getBoundingClientRect().left - origin));
		const nearest = distances.indexOf(Math.min(...distances));
		const left = track.scrollLeft;
		const atEnd = left + track.clientWidth >= track.scrollWidth - 4;
		setActive(atEnd ? slides.length - 1 : Math.max(0, nearest));
		setEdges({ start: left <= 4, end: atEnd });
	}, []);

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

	const goTo = useCallback((index: number) => {
		const track = trackRef.current;
		const slide = track?.querySelectorAll<HTMLElement>("[data-slide]")[index];
		if (!track || !slide) return;
		const origin =
			track.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(track).paddingLeft);
		track.scrollTo({
			left: track.scrollLeft + slide.getBoundingClientRect().left - origin,
			behavior: "smooth",
		});
	}, []);

	return { trackRef, active, edges, goTo };
}

function NavButton({
	icon,
	label,
	disabled,
	onClick,
}: {
	icon: IconSvgElement;
	label: string;
	disabled: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:pointer-events-none disabled:opacity-30"
		>
			<HugeiconsIcon icon={icon} className="size-4" />
		</button>
	);
}

export function SeasonCeremony({
	seasonSlug,
	season,
	leagueSlug,
	canStartNextSeason,
}: {
	seasonSlug: string;
	season: SeasonInfo;
	leagueSlug: string;
	canStartNextSeason: boolean;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));
	const slides = summary ? buildSlides(summary, season) : [];
	const { trackRef, active, edges, goTo } = useCarousel(slides.length);

	if (!summary) return <Skeleton className="h-[520px] w-full rounded-2xl" />;

	const dateRange = `${formatDate(season.startDate)}${season.endDate ? ` – ${formatDate(season.endDate)}` : ""}`;

	return (
		<section
			className="relative isolate w-full overflow-clip rounded-2xl bg-zinc-950 [contain:inline-size] text-zinc-50 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
			data-testid="season-ceremony"
			aria-label={`${season.name} recap`}
		>
			<div className="pointer-events-none absolute -top-48 left-[20%] -z-10 size-[560px] rounded-full bg-amber-500/25 blur-[130px]" />
			<div className="pointer-events-none absolute -bottom-56 right-[-10%] -z-10 size-[520px] rounded-full bg-fuchsia-600/20 blur-[130px]" />
			<div className="pointer-events-none absolute -left-32 top-1/3 -z-10 size-[380px] rounded-full bg-sky-500/10 blur-[110px]" />
			<div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
			<div
				className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay"
				style={{ backgroundImage: GRAIN }}
			/>

			<header className="flex flex-col gap-4 px-5 pt-6 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:pt-7">
				<div className="flex min-w-0 flex-col gap-2">
					<div className="flex items-center gap-2">
						<span className="relative flex size-2">
							<span className="absolute inline-flex size-full rounded-full bg-amber-400 opacity-60 motion-safe:animate-ping" />
							<span className="relative inline-flex size-2 rounded-full bg-amber-400" />
						</span>
						<Eyebrow className="text-amber-200/80">Season recap</Eyebrow>
					</div>
					<h2 className="text-3xl font-black leading-none tracking-tighter [overflow-wrap:anywhere] sm:text-5xl">
						{season.name}
					</h2>
					<p className="text-xs text-zinc-400">
						{dateRange}
						<span className="mx-2 text-zinc-600">/</span>
						{summary.matchCount} matches
						<span className="mx-2 text-zinc-600">/</span>
						{summary.playerCount} players
					</p>
				</div>
				<div className="flex items-center gap-2">
					{canStartNextSeason && (
						<Button
							onClick={() => setIsCreateOpen(true)}
							className="h-9 gap-1.5 rounded-full bg-amber-300 px-4 font-semibold text-zinc-950 shadow-[0_0_30px_-8px_rgba(251,191,36,0.8)] hover:bg-amber-200"
							data-testid="start-next-season-button"
						>
							<HugeiconsIcon icon={Add01Icon} className="size-4" />
							Start next season
						</Button>
					)}
					{slides.length > 1 && (
						<div className="hidden items-center gap-2 sm:flex">
							<NavButton
								icon={ArrowLeft01Icon}
								label="Previous slide"
								disabled={edges.start}
								onClick={() => goTo(Math.max(0, active - 1))}
							/>
							<NavButton
								icon={ArrowRight01Icon}
								label="Next slide"
								disabled={edges.end}
								onClick={() => goTo(Math.min(slides.length - 1, active + 1))}
							/>
						</div>
					)}
				</div>
			</header>

			<div
				ref={trackRef}
				tabIndex={0}
				role="region"
				aria-roledescription="carousel"
				aria-label={`${season.name} highlights`}
				className="mt-6 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overscroll-x-contain px-5 pb-2 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] [scrollbar-width:none] focus-visible:outline-none sm:scroll-px-7 sm:px-7 [&::-webkit-scrollbar]:hidden"
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
							"relative flex h-[340px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white/[0.035] p-5 ring-1 ring-white/10 backdrop-blur-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:ring-white/20 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-8 motion-safe:duration-700 motion-safe:fill-mode-both",
							slideWidth[slide.width]
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
								"h-[3px] w-full rounded-full transition-colors duration-300 group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-amber-300",
								index === active
									? "bg-amber-300"
									: index < active
										? "bg-white/40"
										: "bg-white/15 group-hover/dot:bg-white/30"
							)}
						/>
					</button>
				))}
			</div>

			{canStartNextSeason && (
				<CreateSeasonForm
					isOpen={isCreateOpen}
					onClose={() => setIsCreateOpen(false)}
					onSuccess={(newSeasonSlug) => {
						void navigate({
							to: "/leagues/$slug/seasons/$seasonSlug",
							params: { slug: leagueSlug, seasonSlug: newSeasonSlug },
						});
					}}
				/>
			)}
		</section>
	);
}
