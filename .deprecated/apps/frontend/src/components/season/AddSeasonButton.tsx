import { LayoutActionButton } from "@/components/layout/layout-action-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

export const AddSeasonButton = ({ leagueSlug }: { leagueSlug: string }) => {
  const navigate = useNavigate();
  const { data: hasEditAccess } = trpc.league.hasEditorAccess.useQuery({ leagueSlug });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <LayoutActionButton
          text={"Season"}
          onClick={() =>
            void navigate({ to: "/leagues/$leagueSlug/seasons/create", params: { leagueSlug } })
          }
          Icon={PlusIcon}
        />
      </TooltipTrigger>
      {!hasEditAccess && (
        <TooltipContent side="bottom">
          <p className="w-52">You do not have permission to add a season</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
};
