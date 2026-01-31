import { MatchTable } from "@/components/match/match-table";
import { OverviewCard } from "@/components/season/OverviewCard";
import { EmptyCardContentText } from "@/components/state/empty-card-content";
import { Button } from "@/components/ui/button";
import { useSeason } from "@/context/season-context";
import { trpc } from "@/lib/trpc";
import { useNavigate } from "@tanstack/react-router";

export const LatestMatches = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const navigate = useNavigate();
  const { data, isLoading } = trpc.match.getAll.useQuery({ leagueSlug, seasonSlug, limit: 8 });
  const showEmptyState = !isLoading && data && data.matches.length < 1;
  const showMatches = !isLoading && data && data.matches.length > 0;

  return (
    <OverviewCard title={"Latest Matches"}>
      {showMatches && (
        <>
          <MatchTable matches={data.matches} />
          <div className="flex items-center justify-end space-x-2 pt-4">
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({
                    to: "/leagues/$leagueSlug/seasons/$seasonSlug/matches",
                    params: { leagueSlug, seasonSlug },
                  })
                }
              >
                Show all
              </Button>
            </div>
          </div>
        </>
      )}
      {showEmptyState && <EmptyCardContentText>No registered matches</EmptyCardContentText>}
    </OverviewCard>
  );
};
