"use client";
import { CardContentText } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/CardContentText";
import { DashboardCard } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/DashboardCard";
import { MatchResult } from "@/components/match/match-result";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MatchDTO } from "@/dto";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import { CalendarCheck2, CheckIcon, Undo2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import type { z } from "zod";

export const LatestMatchCard = ({
  leagueSlug,
  seasonSlug,
}: { leagueSlug: string; seasonSlug: string }) => {
  const { data, isLoading } = api.match.getLatest.useQuery({ seasonSlug, leagueSlug });

  return (
    <DashboardCard Icon={CalendarCheck2} title={"Latest Match"}>
      {isLoading && <Skeleton className={"gap-2 h-14 w-full"} />}
      {data && (
        <LatestMatchCardContent match={data} leagueSlug={leagueSlug} seasonSlug={seasonSlug} />
      )}
      {!data && !isLoading && <CardContentText>No Matches</CardContentText>}
    </DashboardCard>
  );
};

const LatestMatchCardContent = ({
  leagueSlug,
  seasonSlug,
  match,
}: {
  leagueSlug: string;
  seasonSlug: string;
  match: z.infer<typeof MatchDTO>;
}) => {
  const { mutate, isPending } = api.match.remove.useMutation();
  const utils = api.useUtils();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();

  const onClickConfirmDelete = async () => {
    setConfirmDelete(false);
    mutate(
      { seasonSlug, leagueSlug, matchId: match.id },
      {
        onSuccess: () => {
          utils.match.getLatest.invalidate();
          utils.seasonPlayer.getTop.invalidate();
          utils.seasonPlayer.getStanding.invalidate();
          utils.seasonTeam.getStanding.invalidate();
          utils.match.getAll.invalidate();
          toast({
            title: "Match reverted",
            description: "Latest match has now been deleted",
          });
        },
        onError: (err) => {
          toast({
            title: "Error creating league",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };
  return (
    <div className="flex gap-4">
      <MatchResult match={match} leagueSlug={leagueSlug} seasonSlug={seasonSlug} />

      {!confirmDelete ? (
        <Button
          variant={"ghost"}
          className={"px-2"}
          disabled={isPending}
          onClick={() => setConfirmDelete(true)}
        >
          <Undo2Icon size={20} />
        </Button>
      ) : (
        <>
          <Button variant={"outline"} className={"px-2"} onClick={() => setConfirmDelete(false)}>
            <XIcon size={20} className={"text-red-500"} />
          </Button>
          <Button variant={"outline"} className={"px-2"} onClick={onClickConfirmDelete}>
            <CheckIcon size={20} className={"text-green-500"} />
          </Button>
        </>
      )}
    </div>
  );
};
