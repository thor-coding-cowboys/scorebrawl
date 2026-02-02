"use client";
import { LayoutActionButton } from "@/components/layout/layout-action-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/trpc/react";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export const AddSeasonButton = ({ leagueSlug }: { leagueSlug: string }) => {
  const { push } = useRouter();
  const { data: hasEditAccess } = api.league.hasEditorAccess.useQuery({ leagueSlug });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <LayoutActionButton
          text={"Season"}
          onClick={() => void push(`/leagues/${leagueSlug}/seasons/create`)}
          Icon={PlusIcon}
        />
      </TooltipTrigger>
      {!hasEditAccess && (
        <TooltipContent side="bottom">
          <p className="w-52">You do now have permission to add a season</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
};
