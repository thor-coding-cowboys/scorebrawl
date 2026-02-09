import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { OverviewCard } from "./overview-card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { MatchRow } from "@/components/match/match-row";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

interface LatestMatchesProps {
	seasonId: string;
	seasonSlug: string;
	canDelete?: boolean;
}

export function LatestMatches({ seasonId, seasonSlug, canDelete }: LatestMatchesProps) {
	const params = useParams({ strict: false });
	const slug = params.slug as string;

	const { data: matchesData } = useQuery({
		queryKey: ["matches", seasonId],
		queryFn: async () => {
			return await trpcClient.match.getAll.query({ seasonSlug, limit: 50, offset: 0 });
		},
		refetchInterval: 5000,
	});
	const matches = matchesData?.matches ?? [];

	const latestMatches = matches.slice(0, 5);
	const showEmptyState = latestMatches.length < 1;
	const showMatches = latestMatches.length > 0;

	return (
		<OverviewCard
			title="Latest Matches"
			action={
				showMatches && (
					<Link to="/leagues/$slug/seasons/$seasonSlug/matches" params={{ slug, seasonSlug }}>
						<Button variant="outline" size="sm">
							<span className="hidden sm:inline">See All</span>
							<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
						</Button>
					</Link>
				)
			}
		>
			{showMatches ? (
				<MatchTable
					matches={latestMatches}
					seasonSlug={seasonSlug}
					seasonId={seasonId}
					canDelete={canDelete}
				/>
			) : showEmptyState ? (
				<div className="flex items-center justify-center h-40 text-muted-foreground">
					No registered matches
				</div>
			) : null}
		</OverviewCard>
	);
}

function MatchTable({
	matches,
	seasonSlug,
	seasonId,
	canDelete,
}: {
	matches: { id: string; homeScore: number; awayScore: number; createdAt: Date }[];
	seasonSlug: string;
	seasonId: string;
	canDelete?: boolean;
}) {
	return (
		<Table>
			<TableBody className="text-sm">
				{matches.map((match, index) => (
					<TableRow key={match.id}>
						<TableCell colSpan={3} className="p-0">
							<MatchRow
								match={match}
								seasonSlug={seasonSlug}
								seasonId={seasonId}
								isLatest={index === 0}
								canDelete={canDelete}
							/>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
