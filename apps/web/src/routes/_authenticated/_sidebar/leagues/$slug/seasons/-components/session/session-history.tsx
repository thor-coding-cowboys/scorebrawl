import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTRPC } from "@/lib/trpc";
import { formatDuration, rotationLabel } from "@/lib/utils";
import { OverviewCard } from "../season/overview-card";
import {
	Clock01Icon,
	Target01Icon,
	UserMultipleIcon,
	ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

function formatSessionDate(d: Date): string {
	return new Date(d).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

export function SessionHistory({ seasonSlug, slug }: { seasonSlug: string; slug: string }) {
	const trpc = useTRPC();

	const { data: sessions, isLoading } = useQuery(
		trpc.session.listEnded.queryOptions({ seasonSlug, limit: 10 })
	);

	if (isLoading) {
		return (
			<OverviewCard title="Session History">
				<div className="space-y-3">
					{Array.from({ length: 3 }, (_, i) => (
						<div key={i} className="flex items-center justify-between gap-3 py-3">
							<div className="flex items-center gap-3 min-w-0">
								<div className="flex flex-col min-w-0 gap-1.5">
									<div className="h-4 w-20 bg-muted rounded animate-pulse" />
									<div className="flex items-center gap-2">
										<div className="h-3 w-16 bg-muted rounded animate-pulse" />
										<div className="h-3 w-12 bg-muted rounded animate-pulse" />
										<div className="h-3 w-12 bg-muted rounded animate-pulse" />
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</OverviewCard>
		);
	}

	if (!sessions || sessions.length === 0) return null;

	return (
		<OverviewCard title="Session History">
			<div className="divide-y divide-border">
				{sessions.map((s) => (
					<Link
						key={s.id}
						to="/leagues/$slug/seasons/$seasonSlug/session/$sessionId/summary"
						params={{ slug, seasonSlug, sessionId: s.id }}
						className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/50 -mx-1 px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:rounded-sm"
					>
						<div className="flex items-center gap-3 min-w-0">
							<div className="flex flex-col min-w-0">
								<span className="text-sm font-medium">{formatSessionDate(s.createdAt)}</span>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span className="flex items-center gap-1">
										<HugeiconsIcon icon={Clock01Icon} className="size-3" />
										{formatDuration(s.createdAt, s.endedAt)}
									</span>
									<span className="flex items-center gap-1">
										<HugeiconsIcon icon={Target01Icon} className="size-3" />
										{s.totalMatches}
									</span>
									<span className="flex items-center gap-1">
										<HugeiconsIcon icon={UserMultipleIcon} className="size-3" />
										{s.playerCount}
									</span>
								</div>
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<span className="text-xs text-muted-foreground hidden sm:inline">
								{rotationLabel(s.rotationMode)}
							</span>
							<HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 text-muted-foreground" />
						</div>
					</Link>
				))}
			</div>
		</OverviewCard>
	);
}
