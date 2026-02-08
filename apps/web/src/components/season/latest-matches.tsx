import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { OverviewCard } from "./overview-card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { MatchRow } from "@/components/match/match-row";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

interface LatestMatchesProps {
	seasonId: string;
	seasonSlug: string;
}

export function LatestMatches({ seasonId, seasonSlug }: LatestMatchesProps) {
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
						<GlowButton
							icon={ArrowRight01Icon}
							glowColor={glowColors.amber}
							size="sm"
							variant="outline"
							className="gap-1.5 whitespace-nowrap"
						>
							<span className="hidden sm:inline">View All</span>
						</GlowButton>
					</Link>
				)
			}
		>
			{showMatches ? (
				<MatchTable matches={latestMatches} seasonSlug={seasonSlug} />
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
}: {
	matches: { id: string; homeScore: number; awayScore: number; createdAt: Date }[];
	seasonSlug: string;
}) {
	return (
		<Table>
			<TableHeader className="text-xs">
				<TableRow>
					<TableHead>Match</TableHead>
					<TableHead className="text-center">Score</TableHead>
					<TableHead className="text-right">Date</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{matches.map((match) => (
					<TableRow key={match.id}>
						<TableCell colSpan={3} className="p-0">
							<MatchRow match={match} seasonSlug={seasonSlug} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
