import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Alert02Icon,
	ArrowRight01Icon,
	ChampionIcon,
	LockIcon,
	Share01Icon,
	Time04Icon,
} from "@hugeicons/core-free-icons";
import { BrandMark } from "@/components/brand-mark";
import { Eyebrow, SeasonRecap } from "@/components/season-recap/season-recap";
import { StandingsPager } from "@/components/standings/standings-pager";
import { StandingsTable } from "@/components/standings/standings-table";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { FormDots } from "@/components/ui/form-dots";
import { glowColors } from "@/components/ui/glow-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	fetchSharedStandings,
	ShareLinkError,
	type SharedMatch,
	type SharedStandingRow,
	type SharedStandingsData,
} from "./shared-standings-data";

const PAGE_SIZE = 10;

const dateFormat = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
	year: "numeric",
});

function formatDate(value: string | null) {
	if (!value) return null;
	return dateFormat.format(new Date(value));
}

const record = ({ winCount, drawCount, lossCount }: SharedStandingRow) =>
	drawCount > 0 ? `${winCount}-${drawCount}-${lossCount}` : `${winCount}-${lossCount}`;

function useDocumentMeta(title: string) {
	useEffect(() => {
		const previousTitle = document.title;
		document.title = title;

		const meta = document.createElement("meta");
		meta.name = "robots";
		meta.content = "noindex, nofollow";
		document.head.appendChild(meta);

		return () => {
			document.title = previousTitle;
			meta.remove();
		};
	}, [title]);
}

function Backdrop() {
	return (
		<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
			<div className="absolute -top-40 left-1/2 h-[560px] w-[min(1100px,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.16),transparent)] dark:bg-[radial-gradient(closest-side,rgba(251,191,36,0.14),transparent)]" />
			<div className="absolute top-[40%] -right-40 size-[520px] rounded-full bg-fuchsia-500/10 blur-[130px] dark:bg-fuchsia-600/15" />
			<div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
		</div>
	);
}

function PageShell({ children, label }: { children: ReactNode; label: string }) {
	return (
		<div className="relative isolate min-h-dvh overflow-x-clip bg-background">
			<Backdrop />
			<header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
				<Link to="/" className="flex items-center gap-2" aria-label="Scorebrawl home">
					<BrandMark className="h-6" />
				</Link>
				<span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm">
					<HugeiconsIcon icon={Share01Icon} className="size-3" />
					{label}
				</span>
			</header>
			<main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">{children}</main>
		</div>
	);
}

function Panel({
	children,
	className,
	glow,
	...props
}: {
	children: ReactNode;
	className?: string;
	glow?: string;
} & React.HTMLAttributes<HTMLElement>) {
	return (
		<section
			className={cn(
				"relative isolate min-w-0 overflow-hidden bg-card text-card-foreground ring-1 ring-foreground/10",
				className
			)}
			{...props}
		>
			{glow && (
				<div
					aria-hidden="true"
					className={cn("pointer-events-none absolute inset-0 -z-10", glow)}
				/>
			)}
			{children}
		</section>
	);
}

function Masthead({ data }: { data: SharedStandingsData }) {
	const expiresOn = formatDate(data.link.expiresAt);
	const isFinal = data.season.closed;

	return (
		<div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
			<div className="flex min-w-0 items-center gap-4">
				<AvatarWithFallback
					src={data.league.logo}
					name={data.league.name}
					size="xl"
					className="size-14 shrink-0 text-lg ring-1 ring-foreground/10 sm:size-16"
				/>
				<div className="flex min-w-0 flex-col gap-1.5">
					<span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
						{isFinal ? (
							<span className="size-1.5 rounded-full bg-amber-500" />
						) : (
							<span className="relative flex size-1.5">
								<span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-75 motion-safe:animate-ping" />
								<span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
							</span>
						)}
						{data.season.name} · {isFinal ? "Final standings" : "Live standings"}
					</span>
					<h1 className="text-3xl font-black leading-[1.05] tracking-tight break-words hyphens-auto sm:text-4xl">
						{data.league.name}
					</h1>
				</div>
			</div>
			<span className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs text-muted-foreground sm:self-auto">
				<HugeiconsIcon icon={Time04Icon} className="size-3.5" />
				{expiresOn ? `Link expires ${expiresOn}` : "Link never expires"}
			</span>
		</div>
	);
}

function LeaderBanner({ data }: { data: SharedStandingsData }) {
	const leader = data.standings[0];
	if (!leader || leader.matchCount === 0) return null;
	const runnerUp = data.standings[1];
	const lead = runnerUp ? leader.score - runnerUp.score : 0;
	const facts = [
		{ label: "Points", value: leader.score },
		{ label: "Record", value: record(leader), detail: leader.drawCount > 0 ? "W-D-L" : "W-L" },
		{ label: "Win rate", value: `${leader.winPct}%` },
		{ label: "Matches", value: leader.matchCount },
	];

	return (
		<Panel
			className="px-5 py-7 sm:px-8 lg:py-9"
			glow="bg-[radial-gradient(60%_140%_at_0%_0%,rgba(14,165,233,0.18),transparent_60%)] dark:bg-[radial-gradient(60%_140%_at_0%_0%,rgba(96,165,250,0.22),transparent_60%)]"
			data-testid="shared-leader-banner"
		>
			<div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent motion-safe:animate-[recap-sheen_6s_ease-in-out_2s_infinite] dark:via-white/[0.07]" />
			<HugeiconsIcon
				icon={ChampionIcon}
				strokeWidth={1}
				className="pointer-events-none absolute -bottom-16 -left-10 size-72 -rotate-12 text-sky-500/[0.07] dark:text-sky-200/[0.05]"
			/>
			<div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
				<div className="flex min-w-0 flex-col gap-5">
					<div className="flex min-w-0 items-center gap-5">
						<div className="shrink-0 rounded-lg p-0.5 shadow-[0_0_56px_-10px_rgba(14,165,233,0.7)] ring-2 ring-sky-500/80 dark:ring-sky-300/80">
							<AvatarWithFallback
								src={leader.image}
								name={leader.name}
								size="xl"
								className="size-16 text-xl sm:size-24 sm:text-3xl"
							/>
						</div>
						<div className="flex min-w-0 flex-col gap-2">
							<span className="inline-flex items-center gap-1.5 self-start rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
								<HugeiconsIcon icon={ChampionIcon} className="size-3" />
								Leading {data.season.name}
							</span>
							<h2 className="text-2xl font-black leading-[1.02] tracking-tight break-words hyphens-auto sm:text-[clamp(2.25rem,3.4vw,3rem)]">
								{leader.name}
							</h2>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/80 sm:text-base">
						<span>
							{runnerUp && lead > 0
								? `${lead} ${lead === 1 ? "point" : "points"} clear of ${runnerUp.name}.`
								: runnerUp
									? `Level on points with ${runnerUp.name}.`
									: `On ${leader.score} points.`}
						</span>
						{leader.form.length > 0 && (
							<span className="inline-flex items-center gap-2">
								<Eyebrow className="tracking-[0.18em]">Last 5</Eyebrow>
								<FormDots form={leader.form} />
							</span>
						)}
					</div>
				</div>
				<dl className="grid grid-cols-2 gap-px overflow-hidden bg-foreground/10 ring-1 ring-foreground/10 sm:grid-cols-4 lg:grid-cols-2">
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
							{fact.detail && <dd className="text-[11px] text-muted-foreground">{fact.detail}</dd>}
						</div>
					))}
				</dl>
			</div>
		</Panel>
	);
}

function PanelHeader({
	eyebrow,
	title,
	children,
}: {
	eyebrow: string;
	title: string;
	children?: ReactNode;
}) {
	return (
		<header className="flex items-end justify-between gap-3 border-b border-foreground/10 px-4 pt-5 pb-4 sm:px-5">
			<div className="flex min-w-0 flex-col gap-1">
				<Eyebrow>{eyebrow}</Eyebrow>
				<h2 className="text-lg font-bold tracking-tight">{title}</h2>
			</div>
			{children}
		</header>
	);
}

function StandingsPanel({ data }: { data: SharedStandingsData }) {
	const [page, setPage] = useState(0);
	const pageCount = Math.max(1, Math.ceil(data.standings.length / PAGE_SIZE));
	const rows = useMemo(
		() => data.standings.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
		[data.standings, page]
	);
	const count = data.standings.length;

	return (
		<Panel>
			<PanelHeader
				eyebrow={`${count} ${count === 1 ? "player" : "players"}`}
				title={data.season.closed ? "Final standings" : "Standings"}
			>
				<StandingsPager page={page} pageCount={pageCount} onPageChange={setPage} />
			</PanelHeader>
			<div className="px-2 pb-2 sm:px-4">
				<StandingsTable rows={rows} showRank emptyLabel="No matches registered yet" />
			</div>
		</Panel>
	);
}

function ResultLine({ label, score, won }: { label: string; score: number; won: boolean }) {
	return (
		<div className="flex items-center gap-3">
			<span
				aria-hidden="true"
				className={cn("h-5 w-0.5 shrink-0", won ? "bg-emerald-500" : "bg-transparent")}
			/>
			<span
				className={cn(
					"line-clamp-2 min-w-0 flex-1 text-sm leading-snug break-words",
					won ? "font-semibold text-foreground" : "text-muted-foreground"
				)}
			>
				{label}
			</span>
			<span
				className={cn(
					"shrink-0 text-xl font-black leading-none tabular-nums tracking-tight",
					won ? "text-foreground" : "text-muted-foreground/70"
				)}
			>
				{score}
			</span>
		</div>
	);
}

function RecentResults({ matches }: { matches: SharedMatch[] }) {
	return (
		<Panel glow="bg-[radial-gradient(110%_70%_at_100%_0%,rgba(16,185,129,0.12),transparent_60%)] dark:bg-[radial-gradient(110%_70%_at_100%_0%,rgba(52,211,153,0.18),transparent_60%)]">
			<PanelHeader eyebrow="Latest" title="Recent results" />
			{matches.length === 0 ? (
				<p className="px-5 py-6 text-sm text-muted-foreground">No matches yet.</p>
			) : (
				<ul className="divide-y divide-foreground/10">
					{matches.map((match) => (
						<li key={match.id} className="flex flex-col gap-1.5 px-4 py-3.5 sm:px-5">
							<span className="pl-3.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
								{formatDate(match.playedAt)}
							</span>
							<ResultLine
								label={match.home.label}
								score={match.home.score}
								won={match.home.score > match.away.score}
							/>
							<ResultLine
								label={match.away.label}
								score={match.away.score}
								won={match.away.score > match.home.score}
							/>
						</li>
					))}
				</ul>
			)}
		</Panel>
	);
}

function SignUpPanel() {
	return (
		<Panel
			className="px-5 py-6"
			glow="bg-[radial-gradient(120%_90%_at_0%_100%,rgba(245,158,11,0.16),transparent_60%)] dark:bg-[radial-gradient(120%_90%_at_0%_100%,rgba(251,191,36,0.18),transparent_60%)]"
		>
			<div className="flex flex-col gap-3">
				<Eyebrow>Scorebrawl</Eyebrow>
				<p className="text-xl font-black leading-tight tracking-tight">Run your own league?</p>
				<p className="text-sm text-muted-foreground">
					Seasons, ELO rankings, live sessions and streaks — free to start.
				</p>
				<Button
					size="sm"
					className="mt-1 w-fit gap-1.5 border hover:opacity-80"
					style={{
						backgroundColor: glowColors.amber.background,
						color: glowColors.amber.text,
						borderColor: glowColors.amber.border,
					}}
					render={<Link to="/" />}
					nativeButton={false}
					data-testid="shared-signup-cta"
				>
					Start a league
					<HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
				</Button>
			</div>
		</Panel>
	);
}

const errorCopy = (
	code: string,
	expiresOn: string | null,
	revokedOn: string | null
): { title: string; body: string } => {
	switch (code) {
		case "expired":
			return {
				title: expiresOn ? `This link expired on ${expiresOn}` : "This link expired",
				body: "Ask a league admin for a fresh link — they can create one in seconds.",
			};
		case "revoked":
			return {
				title: revokedOn ? `This link was revoked on ${revokedOn}` : "This link was revoked",
				body: "The league revoked this link. Ask an admin for a new one.",
			};
		case "sharing_disabled":
			return {
				title: "Sharing was disabled for this league",
				body: "The league owner turned off public links. Ask them to enable it again.",
			};
		case "rate_limited":
			return { title: "Too many requests", body: "Give it a minute and reload the page." };
		default:
			return {
				title: "This link doesn't exist",
				body: "Check the URL — links are long and easy to truncate when pasted.",
			};
	}
};

function ErrorPanel({
	code,
	expiresAt,
	revokedAt,
}: {
	code: string;
	expiresAt: string | null;
	revokedAt: string | null;
}) {
	const message = errorCopy(code, formatDate(expiresAt), formatDate(revokedAt));
	const isLocked = code === "expired" || code === "revoked";

	return (
		<Panel
			className="mx-auto mt-10 max-w-xl"
			glow="bg-[radial-gradient(80%_70%_at_50%_0%,rgba(244,63,94,0.14),transparent_70%)] dark:bg-[radial-gradient(80%_70%_at_50%_0%,rgba(248,113,113,0.2),transparent_70%)]"
		>
			<div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
				<div className="flex size-14 items-center justify-center bg-background/70 ring-1 ring-foreground/10 backdrop-blur-sm">
					<HugeiconsIcon
						icon={isLocked ? LockIcon : Alert02Icon}
						className="size-6 text-rose-600 dark:text-rose-300"
					/>
				</div>
				<Eyebrow>{isLocked ? "Link unavailable" : "Can't open link"}</Eyebrow>
				<h1 className="text-2xl font-black tracking-tight" data-testid="share-error-title">
					{message.title}
				</h1>
				<p className="max-w-sm text-sm text-muted-foreground">{message.body}</p>
				<div className="mt-2 flex flex-wrap items-center justify-center gap-2">
					{code === "rate_limited" && (
						<Button size="sm" variant="outline" onClick={() => window.location.reload()}>
							Reload
						</Button>
					)}
					<Button size="sm" variant="ghost" nativeButton={false} render={<Link to="/" />}>
						Go to Scorebrawl
					</Button>
				</div>
			</div>
		</Panel>
	);
}

function LoadingState() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-4 pb-2">
				<Skeleton className="size-16" />
				<div className="flex flex-col gap-2">
					<Skeleton className="h-3 w-40" />
					<Skeleton className="h-8 w-64" />
				</div>
			</div>
			<Skeleton className="h-64 w-full" />
			<div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<Skeleton className="h-96 w-full" />
				<div className="flex flex-col gap-4">
					<Skeleton className="h-64 w-full" />
					<Skeleton className="h-40 w-full" />
				</div>
			</div>
		</div>
	);
}

export function SharedStandingsPage({ shareKey }: { shareKey: string }) {
	const { data, error, isPending } = useQuery({
		queryKey: ["shared-standings", shareKey],
		queryFn: () => fetchSharedStandings(shareKey),
		retry: false,
	});

	const isRecap = !!data?.summary;
	useDocumentMeta(
		data
			? `${data.league.name} · ${data.season.name}${isRecap ? " recap" : " standings"} · Scorebrawl`
			: "Shared standings · Scorebrawl"
	);
	const label = isRecap ? "Season recap" : "Shared standings";

	if (isPending) {
		return (
			<PageShell label={label}>
				<LoadingState />
			</PageShell>
		);
	}

	if (error) {
		const shareError =
			error instanceof ShareLinkError ? error : new ShareLinkError(500, "not_found");

		return (
			<PageShell label={label}>
				<ErrorPanel
					code={shareError.code}
					expiresAt={shareError.expiresAt}
					revokedAt={shareError.revokedAt}
				/>
			</PageShell>
		);
	}

	return (
		<PageShell label={label}>
			<Masthead data={data} />
			<div className="flex flex-col gap-4 lg:gap-5">
				{data.summary ? (
					<SeasonRecap summary={data.summary} season={data.season} />
				) : (
					<LeaderBanner data={data} />
				)}
				<div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-5">
					<StandingsPanel data={data} />
					<div className="flex flex-col gap-4 lg:gap-5">
						<RecentResults matches={data.recentMatches} />
						<SignUpPanel />
					</div>
				</div>
				<p className="pt-2 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
					Shared from Scorebrawl · {formatDate(data.generatedAt)}
				</p>
			</div>
		</PageShell>
	);
}
