"use client";
import EmptyStateSvg from "@/../public/img/empty-state.svg";
import { OverviewCard } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/OverviewCard";
import { MatchTable } from "@/components/match/match-table";
import { EmptyCardContentText } from "@/components/state/empty-card-content";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSeason } from "@/context/season-context";
import { api } from "@/trpc/react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// TODO Jón save me, this is a mess and doesn't get centered!
const _EmptyState = () => (
  <>
    <CardHeader>
      <CardTitle className="text-md font-medium">No matches</CardTitle>
    </CardHeader>
    <CardContent className={"text-center items-center justify-center p-0 h-60"}>
      <div className={"flex justify-center items-center mb-4"}>
        <Image className="h-32 w-32" alt="empty-state" src={EmptyStateSvg} />
      </div>
      <Button variant={"outline"}>Add Match</Button>
    </CardContent>
  </>
);

export const LatestMatches = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const { push } = useRouter();
  const { data, isLoading } = api.match.getAll.useQuery({ leagueSlug, seasonSlug, limit: 8 });
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
                onClick={() => push(`/leagues/${leagueSlug}/seasons/${seasonSlug}/matches`)}
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
