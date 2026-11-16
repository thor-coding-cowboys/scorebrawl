import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fromHandle, type inferQueryHandle } from "@trpc/tanstack-react-query/unstable-handles";
import { useTRPC, type TRPC } from "@/lib/trpc";
import { OverviewCard } from "./overview-card";
import { MatchRow } from "../match/match-row";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
import { RemoveMatchDialog } from "../match/remove-match-dialog";

interface LatestMatchesProps {
	seasonSlug: string;
	slug: string;
	canDelete?: boolean;
	handle: inferQueryHandle<TRPC["match"]["getAll"]>;
}

export function LatestMatches({ seasonSlug, slug, canDelete, handle }: LatestMatchesProps) {
	const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
	const trpc = useTRPC();

	const { data: matchesData } = useQuery(
		fromHandle(trpc, handle, { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false })
	);
	const matches = matchesData?.matches ?? [];
	const latestMatch = matches[0];

	return (
		<>
			<OverviewCard
				title="Latest Matches"
				action={
					matches.length > 0 && (
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
				{matches.length > 0 ? (
					<MatchTable matches={matches} />
				) : (
					<div
						className="flex items-center justify-center h-40 text-muted-foreground"
						data-testid="latest-matches-empty"
					>
						No registered matches
					</div>
				)}
			</OverviewCard>
			{latestMatch && (
				<RemoveMatchDialog
					isOpen={isRemoveDialogOpen}
					onClose={() => setIsRemoveDialogOpen(false)}
					matchId={latestMatch.id}
					matchInfo={latestMatch}
					seasonSlug={seasonSlug}
				/>
			)}
		</>
	);
}

interface MatchTeam {
	name: string | null;
	logo: string | null;
	players: {
		id: string;
		seasonPlayerId: string;
		result: "W" | "D" | "L";
		scoreBefore: number;
		scoreAfter: number;
		name: string;
		image: string | null;
	}[];
}

function MatchTable({
	matches,
}: {
	matches: {
		id: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
		homeTeam: MatchTeam;
		awayTeam: MatchTeam;
	}[];
}) {
	return (
		<div className="divide-y divide-border overflow-hidden" data-testid="latest-matches-table">
			{matches.map((match) => (
				<div key={match.id} className="py-3 px-2" data-testid={`latest-match-row-${match.id}`}>
					<MatchRow match={match} />
				</div>
			))}
		</div>
	);
}
