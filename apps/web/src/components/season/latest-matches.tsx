import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { OverviewCard } from "./overview-card";
import { MatchRow } from "@/components/match/match-row";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
import { RemoveMatchDialog } from "@/components/match/remove-match-dialog";

interface LatestMatchesProps {
	seasonId: string;
	seasonSlug: string;
	canDelete?: boolean;
}

export function LatestMatches({ seasonId, seasonSlug, canDelete }: LatestMatchesProps) {
	const params = useParams({ strict: false });
	const slug = params.slug as string;
	const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

	const { data: matchesData } = useQuery({
		queryKey: ["matches", seasonId],
		queryFn: async () => {
			return await trpcClient.match.getAll.query({ seasonSlug, limit: 50, offset: 0 });
		},
		refetchInterval: 5000,
	});
	const matches = matchesData?.matches ?? [];

	const latestMatches = matches.slice(0, 5);
	const latestMatch = latestMatches[0];
	const showEmptyState = latestMatches.length < 1;
	const showMatches = latestMatches.length > 0;

	return (
		<>
			<OverviewCard
				title="Latest Matches"
				action={
					showMatches && (
						<div className="flex items-center gap-2">
							{canDelete && latestMatch && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsRemoveDialogOpen(true)}
									className="text-muted-foreground hover:text-destructive"
									data-testid="remove-latest-match-button"
								>
									<span className="hidden sm:inline">Remove Latest</span>
									<HugeiconsIcon icon={Delete01Icon} className="sm:hidden size-4" />
								</Button>
							)}
							<Link to="/leagues/$slug/seasons/$seasonSlug/matches" params={{ slug, seasonSlug }}>
								<Button
									variant="ghost"
									size="sm"
									className="text-muted-foreground hover:text-foreground"
									data-testid="see-all-matches-link"
								>
									<span className="hidden sm:inline">See All</span>
									<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
								</Button>
							</Link>
						</div>
					)
				}
			>
				{showMatches ? (
					<MatchTable matches={latestMatches} seasonSlug={seasonSlug} seasonId={seasonId} />
				) : showEmptyState ? (
					<div
						className="flex items-center justify-center h-40 text-muted-foreground"
						data-testid="latest-matches-empty"
					>
						No registered matches
					</div>
				) : null}
			</OverviewCard>
			{latestMatch && (
				<RemoveMatchDialog
					isOpen={isRemoveDialogOpen}
					onClose={() => setIsRemoveDialogOpen(false)}
					matchId={latestMatch.id}
					matchInfo={latestMatch}
					seasonSlug={seasonSlug}
					seasonId={seasonId}
				/>
			)}
		</>
	);
}

function MatchTable({
	matches,
	seasonSlug,
	seasonId,
}: {
	matches: { id: string; homeScore: number; awayScore: number; createdAt: Date }[];
	seasonSlug: string;
	seasonId: string;
}) {
	return (
		<div className="divide-y divide-border overflow-hidden" data-testid="latest-matches-table">
			{matches.map((match) => (
				<div key={match.id} className="py-3 px-2" data-testid={`latest-match-row-${match.id}`}>
					<MatchRow match={match} seasonSlug={seasonSlug} seasonId={seasonId} />
				</div>
			))}
		</div>
	);
}
