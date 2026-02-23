import { OverviewCard } from "./overview-card";
import { TeamStanding } from "./team-standing";
import { useStandings, useTeamStandings } from "@/lib/collections";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

interface TeamStandingCardProps {
	seasonSlug: string;
}

export function TeamStandingCard({ seasonSlug }: TeamStandingCardProps) {
	const { standings } = useStandings(seasonSlug);
	const { teamStandings } = useTeamStandings(seasonSlug);
	const maxRows = standings.length;

	const [currentPage, setCurrentPage] = useState(0);

	const pageSize = maxRows;
	const totalPages = Math.ceil(teamStandings.length / pageSize);
	const showPagination = maxRows > 0 && totalPages > 1;

	return (
		<OverviewCard
			title="Team Standings"
			action={
				showPagination ? (
					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
							disabled={currentPage === 0}
							className="text-muted-foreground hover:text-foreground"
						>
							<HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
							disabled={currentPage === totalPages - 1}
							className="text-muted-foreground hover:text-foreground"
						>
							<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
						</Button>
					</div>
				) : undefined
			}
		>
			<TeamStanding
				seasonSlug={seasonSlug}
				maxRows={maxRows}
				currentPage={currentPage}
				onPageChange={setCurrentPage}
			/>
		</OverviewCard>
	);
}
