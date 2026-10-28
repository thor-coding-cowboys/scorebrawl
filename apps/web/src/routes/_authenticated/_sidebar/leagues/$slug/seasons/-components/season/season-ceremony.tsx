import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
	Add01Icon,
	ChampionIcon,
	ChartIncreaseIcon,
	CrownIcon,
	FireIcon,
	FlashIcon,
	GameController01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerAvatarGroupInline } from "@/components/ui/player-avatar-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CreateSeasonForm } from "../seasons/create-season-form";

type Summary = RouterOutput["season"]["getSummary"];
type PlayerRef = Summary["champions"][number];

interface PodiumEntry {
	id: string;
	rank: number;
	name: string;
	image: string | null;
	score: number;
	matchCount: number;
	winCount: number;
	lossCount: number;
	drawCount: number;
	winRate: number;
	players?: { id: string; name: string; image: string | null }[];
}

const places = {
	1: {
		step: "h-32 sm:h-36",
		accent: "border-t-amber-500",
		fill: "from-amber-500/15",
		numeral: "text-amber-500",
		order: "order-2",
	},
	2: {
		step: "h-24 sm:h-28",
		accent: "border-t-slate-400",
		fill: "from-slate-400/15",
		numeral: "text-slate-400",
		order: "order-1",
	},
	3: {
		step: "h-20 sm:h-24",
		accent: "border-t-orange-600",
		fill: "from-orange-600/15",
		numeral: "text-orange-600",
		order: "order-3",
	},
} as const;

const record = ({ winCount, drawCount, lossCount }: PodiumEntry) =>
	drawCount > 0 ? `${winCount}-${drawCount}-${lossCount}` : `${winCount}-${lossCount}`;

function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-3">
			<h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
				{children}
			</h3>
			{aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
		</div>
	);
}

function HeroStat({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5 px-5 py-3.5 sm:px-6">
			<span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
				{label}
			</span>
			<span className="text-lg font-bold tabular-nums leading-none">{value}</span>
		</div>
	);
}

function ChampionHero({
	seasonName,
	summary,
	canStartNextSeason,
	onStartNextSeason,
}: {
	seasonName: string;
	summary: Summary;
	canStartNextSeason: boolean;
	onStartNextSeason: () => void;
}) {
	const champion = summary.podium[0];
	const hasChampion = summary.champions.length > 0 && !!champion;
	const isTie = summary.champions.length > 1;

	return (
		<Card
			className="relative gap-0 overflow-hidden py-0 ring-amber-500/30"
			data-testid="champion-banner"
		>
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/12 via-amber-500/[0.03] to-transparent" />
			<HugeiconsIcon
				icon={ChampionIcon}
				strokeWidth={1}
				className="pointer-events-none absolute -right-6 -top-4 size-56 text-amber-500/[0.07]"
			/>
			<div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
				{hasChampion && (
					<div className="relative shrink-0 self-start sm:self-center">
						{isTie ? (
							<PlayerAvatarGroupInline players={summary.champions} size="xl" max={3} />
						) : (
							<div className="rounded-lg ring-2 ring-amber-500/70 ring-offset-2 ring-offset-card">
								<AvatarWithFallback src={champion.image} name={champion.name} size="xl" />
							</div>
						)}
						<span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
							<HugeiconsIcon icon={CrownIcon} className="size-3.5" />
						</span>
					</div>
				)}
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
						{seasonName} · {isTie ? "Co-champions" : "Champion"}
					</span>
					<h2 className="text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
						{hasChampion ? summary.champions.map((c) => c.name).join(" & ") : "No champion crowned"}
					</h2>
					{!hasChampion && (
						<p className="text-xs text-muted-foreground">No matches were played this season.</p>
					)}
				</div>
				{canStartNextSeason && (
					<Button
						className="w-full gap-1.5 sm:w-auto sm:self-start"
						onClick={onStartNextSeason}
						data-testid="start-next-season-button"
					>
						<HugeiconsIcon icon={Add01Icon} className="size-4" />
						Start next season
					</Button>
				)}
			</div>
			{hasChampion && (
				<div className="relative grid grid-cols-2 border-t border-amber-500/20 bg-background/50 sm:grid-cols-4 [&>*:nth-child(even)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+2)]:border-l sm:[&>*:nth-child(n+3)]:border-t-0">
					<HeroStat label="Points" value={champion.score} />
					<HeroStat label="Record" value={record(champion)} />
					<HeroStat label="Win rate" value={`${champion.winRate}%`} />
					<HeroStat label="Matches" value={champion.matchCount} />
				</div>
			)}
		</Card>
	);
}

function PodiumColumn({ entry }: { entry: PodiumEntry }) {
	const place = places[entry.rank as 1 | 2 | 3] ?? places[3];
	const isWinner = entry.rank === 1;
	return (
		<div
			data-testid={`podium-place-${entry.rank}`}
			className={cn("flex min-w-0 flex-col items-center", place.order)}
		>
			<div className="flex w-full flex-col items-center gap-2 pb-3">
				{entry.players && entry.players.length > 0 ? (
					<PlayerAvatarGroupInline
						players={entry.players}
						size={isWinner ? "lg" : "md"}
						max={2}
						className="gap-1"
					/>
				) : (
					<AvatarWithFallback src={entry.image} name={entry.name} size={isWinner ? "xl" : "lg"} />
				)}
				<span
					className="line-clamp-3 min-h-[2.5em] w-full text-center text-[11px] font-semibold leading-tight [overflow-wrap:anywhere] sm:line-clamp-2 sm:text-sm"
					title={entry.name}
				>
					{entry.name}
				</span>
			</div>
			<div
				className={cn(
					"flex w-full flex-col items-center justify-start gap-1 border border-t-2 bg-gradient-to-b to-transparent pt-3",
					place.step,
					place.accent,
					place.fill
				)}
			>
				<span className={cn("text-3xl font-black leading-none tabular-nums", place.numeral)}>
					{entry.rank}
				</span>
				<span className="text-sm font-bold tabular-nums">{entry.score}</span>
				<span className="text-[10px] tabular-nums text-muted-foreground">
					{record(entry)} · {entry.winRate}%
				</span>
			</div>
		</div>
	);
}

function Podium({ title, entries }: { title: string; entries: PodiumEntry[] }) {
	return (
		<Card className="gap-4 px-4 py-4 sm:px-5">
			<SectionHeading aside="pts · W-L · win %">{title}</SectionHeading>
			<div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
				{entries.map((entry) => (
					<PodiumColumn key={entry.id} entry={entry} />
				))}
			</div>
		</Card>
	);
}

interface Moment {
	key: string;
	label: string;
	icon: IconSvgElement;
	tone: string;
	value: ReactNode;
	unit: string;
	players: PlayerRef[];
	caption: string;
	detail?: string;
}

function MomentTile({ moment }: { moment: Moment }) {
	return (
		<Card size="sm" className="gap-3 px-4">
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					{moment.label}
				</span>
				<span className={cn("flex size-7 items-center justify-center rounded-md", moment.tone)}>
					<HugeiconsIcon icon={moment.icon} className="size-4" />
				</span>
			</div>
			<div className="flex items-baseline gap-1.5">
				<span className="text-3xl font-bold leading-none tabular-nums tracking-tight">
					{moment.value}
				</span>
				<span className="text-xs text-muted-foreground">{moment.unit}</span>
			</div>
			<div className="mt-auto flex items-center gap-2 border-t pt-3">
				<PlayerAvatarGroupInline players={moment.players} size="sm" max={2} className="gap-1" />
				<div className="flex min-w-0 flex-col">
					<span className="line-clamp-2 text-xs font-medium leading-snug" title={moment.caption}>
						{moment.caption}
					</span>
					{moment.detail && (
						<span
							className="line-clamp-2 text-[11px] leading-snug text-muted-foreground"
							title={moment.detail}
						>
							{moment.detail}
						</span>
					)}
				</div>
			</div>
		</Card>
	);
}

const names = (players: PlayerRef[]) => players.map((p) => p.name).join(" & ");

function buildMoments({
	longestWinStreak,
	biggestUpset,
	biggestGain,
	mostMatches,
}: Summary["highlights"]) {
	const moments: Moment[] = [];
	if (longestWinStreak) {
		moments.push({
			key: "streak",
			label: "Longest streak",
			icon: FireIcon,
			tone: "bg-red-500/10 text-red-600 dark:text-red-400",
			value: longestWinStreak.length,
			unit: "wins in a row",
			players: [longestWinStreak.player],
			caption: longestWinStreak.player.name,
		});
	}
	if (biggestUpset) {
		moments.push({
			key: "upset",
			label: "Biggest upset",
			icon: FlashIcon,
			tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
			value: `${Math.round(biggestUpset.winnerOdds * 100)}%`,
			unit: "win odds",
			players: biggestUpset.winners,
			caption: names(biggestUpset.winners),
			detail: `${biggestUpset.winnerScore}–${biggestUpset.loserScore} vs ${names(biggestUpset.losers)}`,
		});
	}
	if (biggestGain) {
		moments.push({
			key: "gain",
			label: "Biggest swing",
			icon: ChartIncreaseIcon,
			tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
			value: `+${biggestGain.gain}`,
			unit: "pts in one match",
			players: [biggestGain.player],
			caption: biggestGain.player.name,
		});
	}
	if (mostMatches) {
		moments.push({
			key: "matches",
			label: "Iron player",
			icon: GameController01Icon,
			tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
			value: mostMatches.matchCount,
			unit: "matches played",
			players: [mostMatches.player],
			caption: mostMatches.player.name,
		});
	}
	return moments;
}

export function SeasonCeremony({
	seasonSlug,
	seasonName,
	leagueSlug,
	canStartNextSeason,
}: {
	seasonSlug: string;
	seasonName: string;
	leagueSlug: string;
	canStartNextSeason: boolean;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));

	if (!summary) return <Skeleton className="h-48 w-full" />;

	const moments = buildMoments(summary.highlights);
	const hasTeamPodium = summary.teamPodium.length > 0;

	return (
		<section className="flex flex-col gap-4" data-testid="season-ceremony">
			<ChampionHero
				seasonName={seasonName}
				summary={summary}
				canStartNextSeason={canStartNextSeason}
				onStartNextSeason={() => setIsCreateOpen(true)}
			/>
			{summary.matchCount > 0 && (
				<>
					<div className={cn("grid gap-4", hasTeamPodium && "lg:grid-cols-2")}>
						<Podium title="Player podium" entries={summary.podium} />
						{hasTeamPodium && (
							<Podium
								title="Team podium"
								entries={summary.teamPodium.map((t) => ({ ...t, image: t.logo }))}
							/>
						)}
					</div>
					{moments.length > 0 && (
						<div className="flex flex-col gap-3" data-testid="season-highlights">
							<SectionHeading
								aside={`${summary.matchCount} matches · ${summary.playerCount} players`}
							>
								Season highlights
							</SectionHeading>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
								{moments.map((moment) => (
									<MomentTile key={moment.key} moment={moment} />
								))}
							</div>
						</div>
					)}
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
