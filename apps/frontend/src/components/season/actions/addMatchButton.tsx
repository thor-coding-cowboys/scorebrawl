import { LayoutActionButton } from "@/components/layout/layout-action-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSeason } from "@/context/season-context";
import { trpc } from "@/lib/trpc";
import { useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

export const AddMatchButton = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const navigate = useNavigate();
  const { data: season } = trpc.season.getBySlug.useQuery({ leagueSlug, seasonSlug });
  const { data: ongoingSeasonPlayers } = trpc.seasonPlayer.getAll.useQuery({
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
            !isDisabled &&
            navigate({
              to: "/leagues/$leagueSlug/seasons/$seasonSlug/matches/elo-create",
              params: { leagueSlug, seasonSlug },
            })
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
