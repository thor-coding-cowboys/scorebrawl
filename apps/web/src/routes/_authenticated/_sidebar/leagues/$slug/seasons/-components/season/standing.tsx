import { useStandings } from "@/lib/collections";
import { StandingsTable } from "@/components/standings/standings-table";
import { sortStandings } from "@coding-cowboys/scorebrawl-core/presentation";
import { useNavigate } from "@tanstack/react-router";

interface StandingProps {
	seasonSlug: string;
	leagueSlug?: string;
	highlightPlayerIds?: Set<string>;
}

export function Standing({ seasonSlug, leagueSlug, highlightPlayerIds }: StandingProps) {
	const { standings } = useStandings(seasonSlug);
	const navigate = useNavigate();

	return (
		<StandingsTable
			rows={sortStandings(standings)}
			highlightIds={highlightPlayerIds}
			onRowClick={
				leagueSlug
					? (row) =>
							navigate({
								to: "/leagues/$slug/players/$leaguePlayerId",
								params: {
									slug: leagueSlug,
									leaguePlayerId: row.playerId ?? "",
								},
							})
					: undefined
			}
		/>
	);
}
