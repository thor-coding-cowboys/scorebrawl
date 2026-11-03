import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import {
	ArrowLeft01Icon,
	ArrowRight01Icon,
	ChartIncreaseIcon,
	CrownIcon,
	FireIcon,
	FlashIcon,
	GameController01Icon,
	Medal01Icon,
	PercentCircleIcon,
	Target01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { FormDots } from "@/components/ui/form-dots";
import type { RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export type SeasonRecapSummary = RouterOutput["season"]["getSummary"];
type Summary = SeasonRecapSummary;
type PlayerRef = Summary["champions"][number];
type Standing = Summary["podium"][number];

export interface SeasonRecapInfo {
	name: string;
	scoreType: string;
	startDate: Date | string;
	endDate: Date | string | null;
}

type SeasonInfo = SeasonRecapInfo;

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

interface Fact {
	label: string;
	value: ReactNode;
	detail?: string;
}

const columnWidth = {
	wide: "w-[min(84vw,clamp(340px,34vw,520px))]",
	narrow: "w-[min(72vw,clamp(260px,22vw,340px))]",
} as const;

const cardClass =
	"relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background/70 p-4 ring-1 ring-foreground/10 backdrop-blur-sm transition-[box-shadow] duration-300 hover:ring-foreground/25 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both lg:p-5";

const gridFill = {
	sm: { 0: "", 1: "sm:col-span-2" },
	lg: { 0: "", 1: "lg:col-span-4", 2: "lg:col-span-3", 3: "lg:col-span-2" },
} as const;

const medals = {
	1: {
		step: "h-[104px] lg:h-[150px] from-amber-300/75 via-amber-400/30 to-amber-500/[0.04] dark:from-amber-300/50 dark:via-amber-400/15",
		face: "bg-amber-300 dark:bg-amber-300/85",
		ring: "ring-amber-400 dark:ring-amber-300",
		badge: "bg-amber-500 text-white",
		pill: "bg-amber-500/12 text-amber-700 dark:text-amber-200",
		numeral: "text-amber-700/60 dark:text-amber-100/70",
	},
	2: {
		step: "h-[76px] lg:h-[108px] from-zinc-300/80 via-zinc-300/30 to-zinc-400/[0.04] dark:from-zinc-300/40 dark:via-zinc-300/12",
		face: "bg-zinc-300 dark:bg-zinc-300/80",
		ring: "ring-zinc-400 dark:ring-zinc-300",
		badge: "bg-zinc-500 text-white",
		pill: "bg-zinc-500/12 text-zinc-700 dark:text-zinc-200",
		numeral: "text-zinc-600/50 dark:text-zinc-100/60",
	},
	3: {
		step: "h-[54px] lg:h-[78px] from-orange-300/75 via-orange-400/25 to-orange-500/[0.04] dark:from-orange-400/45 dark:via-orange-400/12",
		face: "bg-orange-300 dark:bg-orange-400/80",
		ring: "ring-orange-400 dark:ring-orange-300",
		badge: "bg-orange-500 text-white",
		pill: "bg-orange-500/12 text-orange-700 dark:text-orange-200",
		numeral: "text-orange-700/50 dark:text-orange-100/60",
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
	amber: {
		glow: "bg-[radial-gradient(110%_80%_at_100%_0%,rgba(245,158,11,0.16),transparent_60%)] dark:bg-[radial-gradient(110%_80%_at_100%_0%,rgba(251,191,36,0.22),transparent_60%)]",
		icon: "text-amber-600 dark:text-amber-300",
		number: "to-amber-500 dark:to-amber-300",
	},
	emerald: {
		glow: "bg-[radial-gradient(110%_80%_at_100%_0%,rgba(16,185,129,0.16),transparent_60%)] dark:bg-[radial-gradient(110%_80%_at_100%_0%,rgba(52,211,153,0.22),transparent_60%)]",
		icon: "text-emerald-600 dark:text-emerald-300",
		number: "to-emerald-500 dark:to-emerald-300",
	},
	pink: {
		glow: "bg-[radial-gradient(110%_80%_at_100%_0%,rgba(236,72,153,0.14),transparent_60%)] dark:bg-[radial-gradient(110%_80%_at_100%_0%,rgba(244,114,182,0.22),transparent_60%)]",
		icon: "text-pink-600 dark:text-pink-300",
		number: "to-pink-500 dark:to-pink-300",
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

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
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
	className,
}: {
	players: { id: string; name: string; image: string | null }[];
	size: "sm" | "md" | "lg" | "xl";
	className?: string;
}) {
	return (
		<div className="flex gap-1">
			{players.slice(0, 2).map((p) => (
				<AvatarWithFallback
					key={p.id}
					src={p.image}
					name={p.name}
					size={size}
					className={className}
				/>
			))}
		</div>
	);
}

function championFacts(summary: Summary, season: SeasonInfo): Fact[] {
	const champion = summary.podium[0];
	if (!champion) return [];
	if (summary.champions.length > 1) {
		return [
			{ label: "Points", value: champion.score },
			{ label: "Matches", value: summary.matchCount },
		];
	}
	const stats = summary.championStats;
	const isElo = season.scoreType !== "3-1-0";
	const facts: Fact[] = [
		{ label: "Points", value: champion.score },
		{ label: "Record", value: record(champion), detail: "W-D-L" },
		{ label: "Win rate", value: `${champion.winRate}%` },
		{ label: "Matches", value: champion.matchCount },
	];
	if (stats) {
		if (isElo && stats.peakScore !== null) {
			facts.push({ label: "Peak rating", value: stats.peakScore });
		}
		if (isElo) {
			facts.push({ label: "Season gain", value: signed(stats.pointsGained), detail: "points" });
		}
		facts.push({
			label: "Best streak",
			value: stats.longestStreak,
			detail: stats.longestStreak === 1 ? "win" : "wins in a row",
		});
		if (stats.biggestWin) {
			facts.push({
				label: "Biggest win",
				value: `${stats.biggestWin.winnerScore}–${stats.biggestWin.loserScore}`,
				detail: stats.biggestWin.opponents.length
					? `vs ${names(stats.biggestWin.opponents)}`
					: undefined,
			});
		}
	}
	return facts;
}

function ChampionBanner({
	summary,
	season,
	action,
}: {
	summary: Summary;
	season: SeasonInfo;
	action: ReactNode;
}) {
	const champion = summary.podium[0];
	const hasChampion = !!champion && summary.champions.length > 0;
	const isTie = summary.champions.length > 1;
	const runnerUp = champion ? summary.podium.find((p) => p.score < champion.score) : undefined;
	const margin = champion && runnerUp ? champion.score - runnerUp.score : 0;
	const facts = hasChampion ? championFacts(summary, season) : [];

	return (
		<div
			className="relative overflow-hidden border-b border-foreground/10 px-5 py-7 sm:px-8 lg:py-9"
			data-testid="champion-banner"
		>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_0%_0%,rgba(245,158,11,0.22),transparent_60%)] dark:bg-[radial-gradient(60%_140%_at_0%_0%,rgba(251,191,36,0.24),transparent_60%)]" />
			<div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent motion-safe:animate-[recap-sheen_6s_ease-in-out_2s_infinite] dark:via-white/[0.07]" />
			<HugeiconsIcon
				icon={CrownIcon}
				strokeWidth={1}
				className="pointer-events-none absolute -left-10 -bottom-16 size-72 -rotate-12 text-amber-500/[0.07] dark:text-amber-200/[0.05]"
			/>
			<div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:items-center">
				<div className="flex min-w-0 flex-col gap-5">
					<div className="flex min-w-0 items-center gap-5">
						{hasChampion &&
							(isTie ? (
								<AvatarPair players={summary.champions} size="xl" />
							) : (
								<div className="shrink-0 rounded-lg p-0.5 shadow-[0_0_56px_-10px_rgba(245,158,11,0.75)] ring-2 ring-amber-500/80 dark:ring-amber-300/80">
									<AvatarWithFallback
										src={champion.image}
										name={champion.name}
										size="xl"
										className="size-16 text-xl sm:size-24 sm:text-3xl"
									/>
								</div>
							))}
						<div className="flex min-w-0 flex-col gap-2">
							<span className="inline-flex items-center gap-1.5 self-start rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
								<HugeiconsIcon icon={CrownIcon} className="size-3" />
								{isTie ? `${season.name} co-champions` : `${season.name} champion`}
							</span>
							<h3 className="text-2xl font-black leading-[1.02] tracking-tight break-words hyphens-auto sm:text-5xl">
								{hasChampion ? names(summary.champions) : "No champion crowned"}
							</h3>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/80 sm:text-base">
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
							<span className="inline-flex items-center gap-2">
								<span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
									Last 5
								</span>
								<FormDots form={champion.form} />
							</span>
						)}
					</div>
					{action}
				</div>

				{facts.length > 0 && (
					<dl
						className={cn(
							"grid grid-cols-2 gap-px overflow-hidden bg-foreground/10 ring-1 ring-foreground/10",
							facts.length > 6
								? "sm:grid-cols-4"
								: facts.length > 4
									? "sm:grid-cols-3"
									: "sm:grid-cols-4"
						)}
					>
						{facts.map((fact) => (
							<div
								key={fact.label}
								className="flex min-w-0 flex-col gap-1.5 bg-background/75 px-4 py-4 backdrop-blur-sm"
							>
								<dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									{fact.label}
								</dt>
								<dd className="whitespace-nowrap text-2xl font-black leading-none tabular-nums tracking-tight">
									{fact.value}
								</dd>
								{fact.detail && (
									<dd
										className="line-clamp-3 text-[11px] leading-snug text-muted-foreground"
										title={fact.detail}
									>
										{fact.detail}
									</dd>
								)}
							</div>
						))}
					</dl>
				)}
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
			<div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[conic-gradient(from_180deg_at_50%_-10%,transparent_42%,rgba(245,158,11,0.16)_50%,transparent_58%)] dark:bg-[conic-gradient(from_180deg_at_50%_-10%,transparent_42%,rgba(251,191,36,0.14)_50%,transparent_58%)]" />
			<div className="relative flex h-full flex-col">
				<Eyebrow>{title}</Eyebrow>
				<div className="relative mt-auto">
					<div className="grid grid-cols-3 items-end gap-1.5 lg:gap-2.5">
						{ordered.map((entry) => {
							const medal = medals[entry.rank as 1 | 2 | 3];
							const isWinner = entry.rank === 1;
							return (
								<div key={entry.id} className="flex min-w-0 flex-col items-center">
									<div className="relative">
										{isWinner && (
											<HugeiconsIcon
												icon={CrownIcon}
												className="absolute -top-6 left-1/2 size-5 -translate-x-1/2 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.7)] lg:-top-7 lg:size-6 dark:text-amber-300"
											/>
										)}
										<div
											className={cn(
												"rounded-lg bg-background p-0.5 ring-2",
												medal.ring,
												isWinner && "shadow-[0_0_28px_-6px_rgba(245,158,11,0.7)]"
											)}
										>
											{entry.players.length > 0 ? (
												<AvatarPair
													players={entry.players}
													size={isWinner ? "lg" : "md"}
													className={isWinner ? "lg:size-12" : "lg:size-10"}
												/>
											) : (
												<AvatarWithFallback
													src={entry.image}
													name={entry.name}
													size={isWinner ? "xl" : "lg"}
													className={isWinner ? "lg:size-20 lg:text-xl" : "lg:size-14 lg:text-base"}
												/>
											)}
										</div>
										<span
											className={cn(
												"absolute -right-2 -bottom-2 flex size-6 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-background",
												medal.badge
											)}
										>
											{entry.rank}
										</span>
									</div>
									<span
										className="mt-3 line-clamp-2 min-h-[2.4em] w-full text-center text-xs font-semibold leading-tight [overflow-wrap:anywhere] lg:text-sm"
										title={entry.name}
									>
										{entry.name}
									</span>
									<span
										className={cn(
											"mt-1.5 mb-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums lg:text-xs",
											medal.pill
										)}
									>
										{entry.score} pts
									</span>
									<div
										className={cn(
											"relative flex w-full items-end justify-center overflow-hidden bg-gradient-to-b shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
											medal.step
										)}
									>
										<div className={cn("absolute inset-x-0 top-0 h-1.5", medal.face)} />
										<span
											className={cn(
												"pb-2 text-4xl font-black leading-none tabular-nums lg:pb-3 lg:text-6xl",
												medal.numeral
											)}
										>
											{entry.rank}
										</span>
									</div>
								</div>
							);
						})}
					</div>
					<div className="h-px w-full bg-foreground/20" />
					<div className="pointer-events-none mx-auto -mt-px h-3 w-11/12 rounded-[50%] bg-black/15 blur-md dark:bg-black/60" />
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
					"pointer-events-none absolute -bottom-5 -right-5 size-28 -rotate-12 opacity-[0.08] lg:size-36",
					tone.icon
				)}
			/>
			<div className="relative flex h-full flex-col">
				<div className="flex items-center justify-between">
					<Eyebrow>{label}</Eyebrow>
					<HugeiconsIcon icon={icon} className={cn("size-4", tone.icon)} />
				</div>
				<div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 lg:mt-5">
					<span
						className={cn(
							"bg-gradient-to-br from-foreground bg-clip-text pr-[0.12em] text-5xl font-black leading-none tracking-tighter text-transparent tabular-nums lg:text-6xl",
							tone.number
						)}
					>
						{value}
					</span>
					<span className="text-xs text-muted-foreground lg:text-sm">{unit}</span>
				</div>
				<div className="mt-auto flex items-center gap-3 border-t border-foreground/10 pt-3">
					<AvatarPair players={players} size="sm" className="lg:size-8" />
					<div className="flex min-w-0 flex-col">
						<span
							className="line-clamp-2 text-xs font-semibold leading-snug lg:text-sm"
							title={caption}
						>
							{caption}
						</span>
						{detail && (
							<span
								className="line-clamp-3 text-[11px] leading-snug text-muted-foreground lg:text-xs"
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
							<span className="text-3xl font-black leading-none tabular-nums tracking-tight lg:text-4xl">
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

	const {
		longestWinStreak,
		biggestUpset,
		biggestWin,
		biggestGain,
		mostWins,
		bestWinRate,
		mostMatches,
	} = summary.highlights;
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
	if (biggestWin) {
		moments.push({
			key: "biggest-win",
			label: "Biggest win",
			content: (
				<MomentCard
					label="Biggest win"
					icon={Target01Icon}
					tone={tones.amber}
					value={`${biggestWin.winnerScore}–${biggestWin.loserScore}`}
					unit="widest margin"
					players={biggestWin.winners}
					caption={names(biggestWin.winners)}
					detail={`vs ${names(biggestWin.losers)}`}
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
	if (mostWins) {
		moments.push({
			key: "most-wins",
			label: "Most wins",
			content: (
				<MomentCard
					label="Most wins"
					icon={Medal01Icon}
					tone={tones.pink}
					value={String(mostWins.winCount)}
					unit="matches won"
					players={[mostWins.player]}
					caption={mostWins.player.name}
				/>
			),
		});
	}
	if (bestWinRate) {
		moments.push({
			key: "best-win-rate",
			label: "Best win rate",
			content: (
				<MomentCard
					label="Best win rate"
					icon={PercentCircleIcon}
					tone={tones.emerald}
					value={`${bestWinRate.winRate}%`}
					unit={`over ${bestWinRate.matchCount} matches`}
					players={[bestWinRate.player]}
					caption={bestWinRate.player.name}
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

	const columns: Column[] = podiums.map((card) => ({
		key: card.key,
		width: "wide",
		cards: [card],
	}));
	for (let i = 0; i < moments.length; i += 2) {
		columns.push({ key: `moments-${i}`, width: "narrow", cards: moments.slice(i, i + 2) });
	}
	const last = columns[columns.length - 1];
	if (last && last.width === "narrow" && last.cards.length === 1) {
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

function RecapGrid({ columns, season }: { columns: Column[]; season: SeasonInfo }) {
	const cards = columns.flatMap((column) =>
		column.cards.map((card) => ({ ...card, wide: column.width === "wide" }))
	);
	const slots = cards.reduce((total, card) => total + (card.wide ? 2 : 1), 0);
	const lastSm = gridFill.sm[(slots % 2) as 0 | 1];
	const lastLg = gridFill.lg[(slots % 4) as 0 | 1 | 2 | 3];

	return (
		<div
			role="region"
			aria-label={`${season.name} highlights`}
			className="grid grid-cols-1 gap-3 px-5 pt-6 pb-6 sm:grid-cols-2 sm:px-8 sm:pb-8 lg:grid-cols-4 lg:gap-4"
		>
			{cards.map((card, index) => {
				const isLast = index === cards.length - 1;
				return (
					<article
						key={card.key}
						aria-label={card.label}
						style={{ animationDelay: `${index * 60}ms` } as CSSProperties}
						className={cn(
							cardClass,
							card.wide
								? "h-[420px] sm:col-span-2 lg:h-[clamp(440px,52vh,540px)]"
								: "min-h-[230px] lg:min-h-[260px]",
							isLast && !card.wide && cn(lastSm, lastLg)
						)}
					>
						{card.content}
					</article>
				);
			})}
		</div>
	);
}

export function SeasonRecap({
	summary,
	season,
	action,
	layout = "scroll",
}: {
	summary: Summary;
	season: SeasonInfo;
	action?: ReactNode;
	layout?: "scroll" | "grid";
}) {
	const columns = summary.matchCount > 0 ? buildColumns(summary, season) : [];
	const { trackRef, visible, position, start, end, page } = useScrollArea(columns.length);
	const canScroll = visible < 0.999;

	return (
		<section
			className="relative isolate w-full overflow-clip bg-card text-card-foreground ring-1 ring-foreground/10 [contain:inline-size]"
			data-testid="season-ceremony"
			aria-label={`${season.name} recap`}
		>
			<div className="pointer-events-none absolute -bottom-56 right-[-10%] -z-10 size-[520px] rounded-full bg-fuchsia-500/10 blur-[130px] dark:bg-fuchsia-600/15" />
			<div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:linear-gradient(to_bottom,transparent,black_40%,transparent)]" />

			<ChampionBanner summary={summary} season={season} action={action} />

			{columns.length > 0 && layout === "grid" && <RecapGrid columns={columns} season={season} />}

			{columns.length > 0 && layout === "scroll" && (
				<>
					<div
						ref={trackRef}
						tabIndex={0}
						role="region"
						aria-label={`${season.name} highlights`}
						className="flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5 pt-6 pb-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] [scrollbar-width:none] focus-visible:outline-none sm:scroll-px-8 sm:px-8 lg:gap-4 [&::-webkit-scrollbar]:hidden"
					>
						{columns.map((column, columnIndex) => (
							<div
								key={column.key}
								className={cn(
									"flex h-[452px] shrink-0 snap-start flex-col gap-3 lg:h-[clamp(500px,56vh,600px)] lg:gap-4",
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
										className={cardClass}
									>
										{card.content}
									</article>
								))}
							</div>
						))}
						<div aria-hidden className="w-1 shrink-0" />
					</div>

					<div className="flex items-center gap-3 px-5 pt-3 pb-6 sm:px-8">
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
		</section>
	);
}
