import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Alert02Icon,
	ArrowRight01Icon,
	LockIcon,
	Share01Icon,
	Time04Icon,
} from "@hugeicons/core-free-icons";
import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StandingsTable } from "@/components/standings/standings-table";
import { StandingsPager } from "@/components/standings/standings-pager";
import {
	fetchSharedStandings,
	ShareLinkError,
	type SharedMatch,
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

function PageShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative isolate min-h-dvh bg-background">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[520px] max-w-4xl page-glow"
			/>
			<header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
				<Link to="/" className="flex items-center gap-2" aria-label="Scorebrawl home">
					<BrandMark className="h-6" />
				</Link>
				<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<HugeiconsIcon icon={Share01Icon} className="size-3.5" />
					Shared standings
				</span>
			</header>
			<main className="mx-auto w-full max-w-5xl px-4 pb-12">{children}</main>
		</div>
	);
}

function LeagueAvatar({ name, logo }: { name: string; logo: string | null }) {
	return (
		<Avatar size="lg" className="size-12">
			{logo ? <AvatarImage src={logo} alt="" /> : null}
			<AvatarFallback className="text-sm font-semibold">
				{name.slice(0, 2).toUpperCase()}
			</AvatarFallback>
		</Avatar>
	);
}

function Hero({ data }: { data: SharedStandingsData }) {
	const expiredLabel = formatDate(data.link.expiresAt);

	return (
		<Card className="relative overflow-hidden">
			<div aria-hidden="true" className="absolute inset-0 card-glow-purple" />
			<CardContent className="relative flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-center gap-3">
					<LeagueAvatar name={data.league.name} logo={data.league.logo} />
					<div className="min-w-0">
						<h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
							{data.league.name}
						</h1>
						<p className="truncate text-sm text-muted-foreground">
							{data.season.name}
							{data.season.closed ? " · Final standings" : ""}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="outline" className="gap-1">
						<HugeiconsIcon icon={Time04Icon} className="size-3" />
						{expiredLabel ? `Expires ${expiredLabel}` : "Never expires"}
					</Badge>
				</div>
			</CardContent>
		</Card>
	);
}

function StandingsCard({ data }: { data: SharedStandingsData }) {
	const [page, setPage] = useState(0);
	const pageCount = Math.max(1, Math.ceil(data.standings.length / PAGE_SIZE));
	const rows = useMemo(
		() => data.standings.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
		[data.standings, page]
	);

	return (
		<Card className="min-w-0">
			<CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border pb-3">
				<div>
					<CardTitle className="text-base font-semibold">Standings</CardTitle>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{data.standings.length} {data.standings.length === 1 ? "player" : "players"}
					</p>
				</div>
				<StandingsPager page={page} pageCount={pageCount} onPageChange={setPage} />
			</CardHeader>
			<CardContent className="px-2 py-0 sm:px-4">
				<StandingsTable rows={rows} showRank emptyLabel="No matches registered yet" />
			</CardContent>
		</Card>
	);
}

function RecentResults({ matches }: { matches: SharedMatch[] }) {
	return (
		<Card className="relative overflow-hidden">
			<div aria-hidden="true" className="absolute inset-0 card-glow-emerald" />
			<CardHeader className="relative border-b border-border pb-3">
				<CardTitle className="text-base font-semibold">Recent results</CardTitle>
			</CardHeader>
			<CardContent className="relative px-0 py-0">
				{matches.length === 0 ? (
					<p className="px-4 py-6 text-sm text-muted-foreground">No matches yet.</p>
				) : (
					<ul className="divide-y divide-border">
						{matches.map((match) => (
							<li key={match.id} className="flex flex-col gap-1 px-4 py-3">
								<div className="flex items-center justify-between gap-3 text-sm">
									<span className="min-w-0 truncate">{match.home.label}</span>
									<span className="shrink-0 font-mono tabular-nums font-semibold">
										{match.home.score}
									</span>
								</div>
								<div className="flex items-center justify-between gap-3 text-sm">
									<span className="min-w-0 truncate text-muted-foreground">{match.away.label}</span>
									<span className="shrink-0 font-mono tabular-nums text-muted-foreground">
										{match.away.score}
									</span>
								</div>
								<p className="text-xs text-muted-foreground">{formatDate(match.playedAt)}</p>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function SignUpCard() {
	return (
		<Card className="relative overflow-hidden">
			<div aria-hidden="true" className="absolute inset-0 card-glow-blue" />
			<CardContent className="relative flex flex-col gap-3 py-2">
				<p className="text-sm font-semibold">Run your own league?</p>
				<p className="text-sm text-muted-foreground">
					Seasons, ELO rankings, live sessions and streaks — free to start.
				</p>
				<Button
					size="sm"
					className="w-fit gap-1.5"
					render={<Link to="/" />}
					nativeButton={false}
					data-testid="shared-signup-cta"
				>
					Start a league
					<HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
				</Button>
			</CardContent>
		</Card>
	);
}

function ErrorCard({
	code,
	expiresAt,
	revokedAt,
}: {
	code: string;
	expiresAt: string | null;
	revokedAt: string | null;
}) {
	const expiredOn = formatDate(expiresAt);
	const revokedOn = formatDate(revokedAt);

	const copy: Record<string, { title: string; body: string }> = {
		expired: {
			title: expiredOn ? `This link expired on ${expiredOn}` : "This link expired",
			body: "Ask a league admin for a fresh link — they can create one in seconds.",
		},
		revoked: {
			title: revokedOn ? `This link was revoked on ${revokedOn}` : "This link was revoked",
			body: "The league revoked this link. Ask an admin for a new one.",
		},
		sharing_disabled: {
			title: "Sharing was disabled for this league",
			body: "The league owner turned off public links. Ask them to enable it again.",
		},
		rate_limited: {
			title: "Too many requests",
			body: "Give it a minute and reload the page.",
		},
		not_found: {
			title: "This link doesn't exist",
			body: "Check the URL — links are long and easy to truncate when pasted.",
		},
	};

	const message = copy[code] ?? copy.not_found;

	return (
		<Card className="relative mx-auto mt-6 max-w-xl overflow-hidden">
			<div aria-hidden="true" className="absolute inset-0 card-glow-red" />
			<CardContent className="relative flex flex-col items-center gap-3 py-10 text-center">
				<div className="flex size-12 items-center justify-center border border-border bg-background/60">
					<HugeiconsIcon
						icon={code === "expired" || code === "revoked" ? LockIcon : Alert02Icon}
						className="size-6 text-destructive"
					/>
				</div>
				<h1 className="text-lg font-bold" data-testid="share-error-title">
					{message.title}
				</h1>
				<p className="max-w-sm text-sm text-muted-foreground">{message.body}</p>
				{code === "rate_limited" && (
					<Button size="sm" variant="outline" onClick={() => window.location.reload()}>
						Reload
					</Button>
				)}
				<Button size="sm" variant="ghost" nativeButton={false} render={<Link to="/" />}>
					Go to Scorebrawl
				</Button>
			</CardContent>
		</Card>
	);
}

function LoadingState() {
	return (
		<div className="flex flex-col gap-4 pt-2">
			<Skeleton className="h-24 w-full" />
			<div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<Skeleton className="h-96 w-full" />
				<div className="flex flex-col gap-4">
					<Skeleton className="h-64 w-full" />
					<Skeleton className="h-32 w-full" />
				</div>
			</div>
		</div>
	);
}

export function SharedStandingsPage({ shareKey }: { shareKey: string }) {
	useDocumentMeta("Shared standings · Scorebrawl");

	const { data, error, isPending } = useQuery({
		queryKey: ["shared-standings", shareKey],
		queryFn: () => fetchSharedStandings(shareKey),
		retry: false,
	});

	if (isPending) {
		return (
			<PageShell>
				<LoadingState />
			</PageShell>
		);
	}

	if (error) {
		const shareError =
			error instanceof ShareLinkError ? error : new ShareLinkError(500, "not_found");

		return (
			<PageShell>
				<ErrorCard
					code={shareError.code}
					expiresAt={shareError.expiresAt}
					revokedAt={shareError.revokedAt}
				/>
			</PageShell>
		);
	}

	return (
		<PageShell>
			<div className="flex flex-col gap-4">
				<Hero data={data} />
				<div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
					<StandingsCard data={data} />
					<div className="flex flex-col gap-4">
						<RecentResults matches={data.recentMatches} />
						<SignUpCard />
					</div>
				</div>
				<p className="text-center text-xs text-muted-foreground">
					Shared from Scorebrawl · {formatDate(data.generatedAt)}
				</p>
			</div>
		</PageShell>
	);
}
