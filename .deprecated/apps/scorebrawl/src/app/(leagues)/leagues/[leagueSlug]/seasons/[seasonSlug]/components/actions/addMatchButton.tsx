"use client";
import { LayoutActionButton } from "@/components/layout/layout-action-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSeason } from "@/context/season-context";
import { api } from "@/trpc/react";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export const AddMatchButton = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const { push } = useRouter();
  const { data: season } = api.season.getBySlug.useQuery({ leagueSlug, seasonSlug });
  const { data: ongoingSeasonPlayers } = api.seasonPlayer.getAll.useQuery({
    leagueSlug,
    seasonSlug,
  });
  const hasTwoPlayersOrMore = ongoingSeasonPlayers && ongoingSeasonPlayers.length > 1;
  const isSeasonClosed = season?.closed ?? false;
  const isDisabled = !hasTwoPlayersOrMore || !season || isSeasonClosed;

  return (
    <Tooltip>
      <TooltipTrigger>
        <LayoutActionButton
          text={"Match"}
          onClick={() =>
            !isDisabled && push(`/leagues/${leagueSlug}/seasons/${seasonSlug}/matches/elo-create`)
          }
          Icon={PlusIcon}
          disabled={isDisabled}
        />
      </TooltipTrigger>
      {isDisabled && (
        <TooltipContent side="bottom">
          <p className="w-52">
            {isSeasonClosed
              ? "This season is over"
              : "An ongoing season or at least two players required for adding match"}
          </p>
        </TooltipContent>
      )}
    </Tooltip>
  );
};
