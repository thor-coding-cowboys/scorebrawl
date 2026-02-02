"use client";

import { AvatarName } from "@/components/avatar/avatar-name";
import { MultiAvatar } from "@/components/multi-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import { sortSeasons } from "@/utils/season-utils";
import { getPeriodStatus } from "@scorebrawl/utils/date";
import { Ban, CircleCheck, CirclePlay, FastForward, Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";

const TopPlayerCell = ({ seasonSlug, leagueSlug }: { seasonSlug: string; leagueSlug: string }) => {
  const { data } = api.seasonPlayer.getTop.useQuery({ leagueSlug, seasonSlug });

  if (!data) {
    return null;
  }
  return <AvatarName textClassName={"text-xs"} name={data.user.name} image={data.user.image} />;
};

const TopTeamCell = ({ seasonSlug, leagueSlug }: { seasonSlug: string; leagueSlug: string }) => {
  const { data } = api.seasonTeam.getTop.useQuery({ leagueSlug, seasonSlug });
  if (!data) {
    return null;
  }
  return (
    <div className="flex items-center">
      <div className="relative">
        <MultiAvatar users={data.players} visibleCount={3} />
      </div>
      <div className="ml-4">
        <h2 className={"text-xs"}>{data?.name}</h2>
      </div>
    </div>
  );
};

const ActionCell = ({
  season,
  leagueSlug,
}: {
  season: { id: string; slug: string; closed: boolean; name: string };
  leagueSlug: string;
}) => {
  const { toast } = useToast();
  const utils = api.useUtils();
  const updateClosedStatus = api.season.updateClosedStatus.useMutation({
    onSuccess: () => {
      void utils.season.getAll.invalidate({ leagueSlug });
      toast({
        title: season.closed ? "Season reopened" : "Season closed",
        description: season.closed
          ? `${season.name} has been reopened for new matches.`
          : `${season.name} has been closed. No new matches can be created.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update season status.",
      });
    },
  });

  const handleToggleClosed = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateClosedStatus.mutate({
      leagueSlug,
      seasonSlug: season.slug,
      closed: !season.closed,
    });
  };

  return (
    <div className="flex items-center space-x-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleClosed}
            disabled={updateClosedStatus.isPending}
          >
            {season.closed ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{season.closed ? "Reopen Season" : "Close Season"}</TooltipContent>
      </Tooltip>
    </div>
  );
};

export const SeasonTable = ({
  leagueSlug,
  showTopPlayerAndTeam,
}: {
  leagueSlug: string;
  showTopPlayerAndTeam?: boolean;
}) => {
  const { push } = useRouter();
  const { data, isLoading } = api.season.getAll.useQuery({ leagueSlug });
  const { data: hasEditorAccess } = api.league.hasEditorAccess.useQuery({ leagueSlug });
  const seasons = sortSeasons(data ?? []);
  return (
    <>
      {isLoading && <Skeleton className="h-96 w-full" />}
      {!isLoading && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              {showTopPlayerAndTeam && <TableHead>Top Player</TableHead>}
              {showTopPlayerAndTeam && <TableHead>Top Team</TableHead>}
              {hasEditorAccess && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody className="relative w-full">
            {seasons?.map((season) => {
              const periodStatus = getPeriodStatus(season);
              let StatusIcon = null;
              let statusText = "";

              if (season.closed) {
                StatusIcon = Ban;
                statusText = "closed";
              } else if (periodStatus === "ongoing") {
                StatusIcon = CirclePlay;
                statusText = "ongoing";
              } else if (periodStatus === "finished") {
                StatusIcon = CircleCheck;
                statusText = "finished";
              } else {
                StatusIcon = FastForward;
                statusText = "future";
              }
              return (
                <TableRow
                  key={season.id}
                  className="cursor-pointer"
                  onClick={() => push(`/leagues/${leagueSlug}/seasons/${season.slug}`)}
                >
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger>
                        <StatusIcon className={"h-6 w-6 pointer-events-none"} />
                      </TooltipTrigger>
                      <TooltipContent className="capitalize">{statusText}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs w-4/5"> {season.name}</p>
                  </TableCell>
                  <TableCell>
                    <p className={"text-xs"}>
                      {season.startDate.toLocaleDateString(window.navigator.language)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className={"text-xs"}>
                      {season.endDate
                        ? season.endDate.toLocaleDateString(window.navigator.language)
                        : "-"}
                    </p>
                  </TableCell>
                  {showTopPlayerAndTeam && (
                    <>
                      <TableCell>
                        <TopPlayerCell seasonSlug={season.slug} leagueSlug={leagueSlug} />
                      </TableCell>
                      <TableCell>
                        <TopTeamCell seasonSlug={season.slug} leagueSlug={leagueSlug} />
                      </TableCell>
                    </>
                  )}
                  {hasEditorAccess && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionCell season={season} leagueSlug={leagueSlug} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
};
