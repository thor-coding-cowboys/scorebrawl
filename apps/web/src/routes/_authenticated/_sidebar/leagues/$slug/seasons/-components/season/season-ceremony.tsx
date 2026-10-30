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
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
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

interface Card {
	key: string;
	label: string;
	content: ReactNode;
}

interface Column {
	key: string;
	width: "wide" | "narrow";
	cards: Card[];
}

const columnWidth = {
	wide: "w-[min(84vw,380px)]",
	narrow: "w-[min(70vw,270px)]",
} as const;

const medals = {
	1: {
		bar: "h-[68px] border-amber-500 from-amber-400/45 dark:from-amber-300/50",
		text: "text-amber-600 dark:text-amber-300",
	},
	2: {
		bar: "h-[50px] border-zinc-400 from-zinc-400/35 dark:from-zinc-300/35",
		text: "text-zinc-500 dark:text-zinc-200",
	},
	3: {
		bar: "h-[38px] border-orange-500 from-orange-400/40 dark:from-orange-400/45",
		text: "text-orange-600 dark:text-orange-300",
	},
} as const;

const tones = {
	rose: {
		glow: "bg-[radial-gradient(110%_80%_at_100%_0%,rgba(244,63,94,0.16),transparent_60%)] dark:bg-[radial-gradient(110%_80%_at_100%_0%,rgba(248,113,113,0.24),transparent_60%)]",
		icon: "text-rose-600 dark:text-rose-300",
		number: "to-rose-500 dark:to-rose-300",
	},
	violet: {
		glow: "bg-[radial-gradient(110%_80%_at_100%_0%,rgba(139,92,246,0.16),transparent_60%)] dark:bg-[radial-gradient(110%_80%_at_100%_0%,rgba(192,132,252,0.26),transparent_60%)]",
		icon: "text-violet-600 dark:text-violet-300",
		number: "to-violet-500 dark:to-violet-300",
	},
	emerald: {
		glow: "bg-[radial-gradient(110%_80%_at_100%_0%,rgba(16,185,129,0.16),transparent_60%)] dark:bg-[radial-gradient(110%_80%_at_100%_0%,rgba(52,211,153,0.22),transparent_60%)]",
		icon: "text-emerald-600 dark:text-emerald-300",
		number: "to-emerald-500 dark:to-emerald-300",
	},
	sky: {
		glow: "bg-[radial-gradient(110%_80%_at_100%_0%,rgba(14,165,233,0.16),transparent_60%)] dark:bg-[radial-gradient(110%_80%_at_100%_0%,rgba(96,165,250,0.24),transparent_60%)]",
		icon: "text-sky-600 dark:text-sky-300",
		number: "to-sky-500 dark:to-sky-300",
	},
} as const;

type Tone = (typeof tones)[keyof typeof tones];

const DAY_MS = 24 * 60 * 60 * 1000;

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

function ChampionBanner({ summary, action }: { summary: Summary; action: ReactNode }) {
	const champion = summary.podium[0];
	const hasChampion = !!champion && summary.champions.length > 0;
	const isTie = summary.champions.length > 1;
	const runnerUp = champion ? summary.podium.find((p) => p.score < champion.score) : undefined;
	const margin = champion && runnerUp ? champion.score - runnerUp.score : 0;

	return (
		<div
			className="relative overflow-hidden border-b border-foreground/10 px-5 py-6 sm:px-7"
			data-testid="champion-banner"
		>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_140%_at_0%_0%,rgba(245,158,11,0.22),transparent_60%)] dark:bg-[radial-gradient(70%_140%_at_0%_0%,rgba(251,191,36,0.24),transparent_60%)]" />
			<div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent motion-safe:animate-[recap-sheen_6s_ease-in-out_2s_infinite] dark:via-white/[0.07]" />
			<HugeiconsIcon
				icon={CrownIcon}
				strokeWidth={1}
				className="pointer-events-none absolute -right-10 -top-12 size-64 rotate-12 text-amber-500/[0.08] dark:text-amber-200/[0.06]"
			/>
			<div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex min-w-0 items-center gap-5">
					{hasChampion &&
						(isTie ? (
							<AvatarPair players={summary.champions} size="lg" />
						) : (
							<div className="shrink-0 rounded-lg p-0.5 shadow-[0_0_44px_-8px_rgba(245,158,11,0.7)] ring-2 ring-amber-500/80 dark:ring-amber-300/80">
								<AvatarWithFallback src={champion.image} name={champion.name} size="xl" />
							</div>
						))}
					<div className="flex min-w-0 flex-col gap-2">
						<span className="inline-flex items-center gap-1.5 self-start rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
							<HugeiconsIcon icon={CrownIcon} className="size-3" />
							{isTie ? "Season co-champions" : "Season champion"}
						</span>
						<h3 className="text-3xl font-black leading-[1.05] tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
							{hasChampion ? names(summary.champions) : "No champion crowned"}
						</h3>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-foreground/80">
							<span>
								{!hasChampion
									? "No matches were played this season."
									: isTie
										? `Shared the title on ${champion.score} points.`
										: runnerUp
											? `Finished ${margin} ${margin === 1 ? "point" : "points"} clear of ${runnerUp.name}.`
											: `Took the title with ${champion.score} points.`}
							</span>
							{hasChampion && !isTie && champion.form.length > 0 && (
								<FormDots form={champion.form} />
							)}
						</div>
					</div>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
					{hasChampion && (
						<div className="grid w-full grid-cols-4 divide-x divide-foreground/10 bg-background/60 py-2.5 ring-1 ring-foreground/10 sm:w-auto sm:min-w-[340px]">
							{[
								{ label: "Points", value: champion.score },
								{ label: "Record", value: record(champion) },
								{ label: "Win rate", value: `${champion.winRate}%` },
								{ label: "Matches", value: champion.matchCount },
							].map((stat) => (
								<div
									key={stat.label}
									className="flex min-w-0 flex-col items-center gap-1 px-1 sm:px-3"
								>
									<span className="whitespace-nowrap text-base font-bold tabular-nums tracking-tight sm:text-lg">
										{stat.value}
									</span>
									<span className="whitespace-nowrap text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:tracking-[0.18em]">
										{stat.label}
									</span>
								</div>
							))}
						</div>
					)}
					{action}
				</div>
			</div>
		</div>
	);
}

function PodiumCard({ title, entries }: { title: string; entries: PodiumEntry[] }) {
	const ordered = [2, 1, 3]
		.map((rank) => entries.find((e) => e.rank === rank))
		.filter((e): e is PodiumEntry => !!e);
	return (
		<>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_100%,rgba(245,158,11,0.12),transparent_70%)]" />
			<div className="relative flex h-full flex-col">
				<Eyebrow>{title}</Eyebrow>
				<div className="mt-auto grid grid-cols-3 items-end gap-2">
					{ordered.map((entry) => {
						const medal = medals[entry.rank as 1 | 2 | 3];
						return (
							<div key={entry.id} className="flex min-w-0 flex-col items-center gap-1.5">
								{entry.players.length > 0 ? (
									<AvatarPair players={entry.players} size="sm" />
								) : (
									<AvatarWithFallback
										src={entry.image}
										name={entry.name}
										size={entry.rank === 1 ? "md" : "sm"}
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
										"flex w-full flex-col items-center border-t-2 bg-gradient-to-b to-transparent pt-1.5",
										medal.bar
									)}
								>
									<span className={cn("text-xl font-black leading-none", medal.text)}>
										{entry.rank}
									</span>
									<span className="mt-0.5 text-[11px] font-semibold tabular-nums">
										{entry.score}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</>
	);
}

function MomentCard({
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
					"pointer-events-none absolute -bottom-5 -right-5 size-28 -rotate-12 opacity-[0.08]",
					tone.icon
				)}
			/>
			<div className="relative flex h-full flex-col">
				<div className="flex items-center justify-between">
					<Eyebrow>{label}</Eyebrow>
					<HugeiconsIcon icon={icon} className={cn("size-4", tone.icon)} />
				</div>
				<div className="mt-3 flex items-baseline gap-2">
					<span
						className={cn(
							"bg-gradient-to-br from-foreground bg-clip-text text-5xl font-black leading-none tracking-tighter text-transparent tabular-nums",
							tone.number
						)}
					>
						{value}
					</span>
					<span className="text-xs text-muted-foreground">{unit}</span>
				</div>
				<div className="mt-auto flex items-center gap-3 border-t border-foreground/10 pt-3">
					<AvatarPair players={players} size="sm" />
					<div className="flex min-w-0 flex-col">
						<span className="line-clamp-2 text-xs font-semibold leading-snug" title={caption}>
							{caption}
						</span>
						{detail && (
							<span
								className="line-clamp-3 text-[11px] leading-snug text-muted-foreground"
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

function NumbersCard({ summary, season }: { summary: Summary; season: SeasonInfo }) {
	const stats: { label: string; value: string | number }[] = [
		{ label: "Matches", value: summary.matchCount },
		{ label: "Players", value: summary.playerCount },
	];
	const [champion, runnerUp] = summary.podium;
	if (champion && runnerUp) {
		stats.push({ label: "Title margin", value: `+${champion.score - runnerUp.score}` });
	}
	if (season.endDate) {
		const days = Math.max(
			1,
			Math.round(
				(new Date(season.endDate).getTime() - new Date(season.startDate).getTime()) / DAY_MS
			)
		);
		stats.push({ label: days === 1 ? "Day" : "Days", value: days });
	}
	return (
		<>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_70%_at_0%_100%,rgba(14,165,233,0.12),transparent_65%)] dark:bg-[radial-gradient(100%_70%_at_0%_100%,rgba(56,189,248,0.16),transparent_65%)]" />
			<div className="relative flex h-full flex-col">
				<Eyebrow>By the numbers</Eyebrow>
				<div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-5 pt-3">
					{stats.map((stat) => (
						<div key={stat.label} className="flex flex-col gap-1">
							<span className="text-3xl font-black leading-none tabular-nums tracking-tight">
								{stat.value}
							</span>
							<span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
								{stat.label}
							</span>
						</div>
					))}
				</div>
			</div>
		</>
	);
}

function buildColumns(summary: Summary, season: SeasonInfo): Column[] {
	const podiums: Card[] = [
		{
			key: "podium",
			label: "Player podium",
			content: (
				<PodiumCard
					title="Player podium"
					entries={summary.podium.map((p) => ({ ...p, players: [] }))}
				/>
			),
		},
	];
	if (summary.teamPodium.length > 0) {
		podiums.push({
			key: "team-podium",
			label: "Team podium",
			content: (
				<PodiumCard
					title="Team podium"
					entries={summary.teamPodium.map((t) => ({ ...t, image: t.logo }))}
				/>
			),
		});
	}

	const { longestWinStreak, biggestUpset, biggestGain, mostMatches } = summary.highlights;
	const moments: Card[] = [];
	if (longestWinStreak) {
		moments.push({
			key: "streak",
			label: "Longest streak",
			content: (
				<MomentCard
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
		moments.push({
			key: "upset",
			label: "Biggest upset",
			content: (
				<MomentCard
					label="Biggest upset"
					icon={FlashIcon}
					tone={tones.violet}
					value={`${Math.round(biggestUpset.winnerOdds * 100)}%`}
					unit="odds to win"
					players={biggestUpset.winners}
					caption={names(biggestUpset.winners)}
					detail={`${biggestUpset.winnerScore}–${biggestUpset.loserScore} vs ${names(biggestUpset.losers)}`}
				/>
			),
		});
	}
	if (biggestGain) {
		moments.push({
			key: "gain",
			label: "Biggest swing",
			content: (
				<MomentCard
					label="Biggest swing"
					icon={ChartIncreaseIcon}
					tone={tones.emerald}
					value={`+${biggestGain.gain}`}
					unit="pts in one match"
					players={[biggestGain.player]}
					caption={biggestGain.player.name}
				/>
			),
		});
	}
	if (mostMatches) {
		moments.push({
			key: "matches",
			label: "Iron player",
			content: (
				<MomentCard
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
	const numbers: Card = {
		key: "numbers",
		label: "By the numbers",
		content: <NumbersCard summary={summary} season={season} />,
	};

	const columns: Column[] = [{ key: "podiums", width: "wide", cards: podiums }];
	for (let i = 0; i < moments.length; i += 2) {
		columns.push({ key: `moments-${i}`, width: "narrow", cards: moments.slice(i, i + 2) });
	}
	const last = columns[columns.length - 1];
	if (last.width === "narrow" && last.cards.length === 1) {
		last.cards.push(numbers);
	} else {
		columns.push({ key: "numbers", width: "narrow", cards: [numbers] });
	}
	return columns;
}

function useScrollArea(count: number) {
	const trackRef = useRef<HTMLDivElement>(null);
	const [state, setState] = useState({ visible: 1, position: 0, start: true, end: true });

	const measure = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		const overflow = track.scrollWidth - track.clientWidth;
		setState({
			visible: Math.min(1, track.clientWidth / track.scrollWidth),
			position: overflow > 0 ? track.scrollLeft / overflow : 0,
			start: track.scrollLeft <= 4,
			end: track.scrollLeft >= overflow - 4,
		});
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

	const page = useCallback((direction: 1 | -1) => {
		const track = trackRef.current;
		if (!track) return;
		track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
	}, []);

	return { trackRef, ...state, page };
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
	const columns = summary && summary.matchCount > 0 ? buildColumns(summary, season) : [];
	const { trackRef, visible, position, start, end, page } = useScrollArea(columns.length);

	if (!summary) return <Skeleton className="h-[640px] w-full" />;

	const canScroll = visible < 0.999;

	return (
		<section
			className="relative isolate w-full overflow-clip bg-card text-card-foreground ring-1 ring-foreground/10 [contain:inline-size]"
			data-testid="season-ceremony"
			aria-label={`${season.name} recap`}
		>
			<div className="pointer-events-none absolute -bottom-56 right-[-10%] -z-10 size-[520px] rounded-full bg-fuchsia-500/10 blur-[130px] dark:bg-fuchsia-600/15" />
			<div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:linear-gradient(to_bottom,transparent,black_40%,transparent)]" />

			<ChampionBanner
				summary={summary}
				action={
					canStartNextSeason && (
						<GlowButton
							icon={Add01Icon}
							glowColor={glowColors.amber}
							size="sm"
							className="gap-1.5 self-start lg:self-end"
							onClick={() => setIsCreateOpen(true)}
							data-testid="start-next-season-button"
						>
							Start next season
						</GlowButton>
					)
				}
			/>

			{columns.length > 0 && (
				<>
					<div
						ref={trackRef}
						tabIndex={0}
						role="region"
						aria-label={`${season.name} highlights`}
						className="flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5 pt-5 pb-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] [scrollbar-width:none] focus-visible:outline-none sm:scroll-px-7 sm:px-7 [&::-webkit-scrollbar]:hidden"
					>
						{columns.map((column, columnIndex) => (
							<div
								key={column.key}
								className={cn(
									"flex h-[452px] shrink-0 snap-start flex-col gap-3",
									columnWidth[column.width]
								)}
							>
								{column.cards.map((card, cardIndex) => (
									<article
										key={card.key}
										aria-label={card.label}
										style={
											{ animationDelay: `${(columnIndex * 2 + cardIndex) * 60}ms` } as CSSProperties
										}
										className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background/70 p-4 ring-1 ring-foreground/10 backdrop-blur-sm transition-[box-shadow] duration-300 hover:ring-foreground/25 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both"
									>
										{card.content}
									</article>
								))}
							</div>
						))}
						<div aria-hidden className="w-1 shrink-0" />
					</div>

					<div className="flex items-center gap-3 px-5 pt-3 pb-5 sm:px-7">
						<div className="relative h-[3px] flex-1 bg-foreground/10" aria-hidden>
							{canScroll && (
								<div
									className="absolute inset-y-0 bg-amber-500 transition-[left] duration-150"
									style={{
										width: `${visible * 100}%`,
										left: `${position * (1 - visible) * 100}%`,
									}}
								/>
							)}
						</div>
						{canScroll && (
							<div className="flex items-center gap-1">
								<Button
									variant="outline"
									size="icon-sm"
									aria-label="Scroll highlights left"
									disabled={start}
									onClick={() => page(-1)}
								>
									<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
								</Button>
								<Button
									variant="outline"
									size="icon-sm"
									aria-label="Scroll highlights right"
									disabled={end}
									onClick={() => page(1)}
								>
									<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
								</Button>
							</div>
						)}
					</div>
				</>
			)}

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
