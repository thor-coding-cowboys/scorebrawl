"use client";
import { CardContentText } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/CardContentText";
import { DashboardCard } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/DashboardCard";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { BarChart3 } from "lucide-react";

export const InfoCard = ({
  leagueSlug,
  seasonSlug,
}: { leagueSlug: string; seasonSlug: string }) => {
  const { data, isLoading } = api.season.getCountInfo.useQuery({ seasonSlug, leagueSlug });

  return (
    <DashboardCard Icon={BarChart3} title={"General Info"}>
      {isLoading && <Skeleton className={"gap-2 h-4 w-full"} />}
      {data && (
        <div className="grid grid-cols-3">
          <CardContentText>
            <span className="font-bold">{data.matchCount}</span> Matches
          </CardContentText>
          <CardContentText>
            <span className="font-bold">{data.playerCount}</span> Players
          </CardContentText>
          <CardContentText>
            <span className="font-bold">{data.teamCount}</span> Teams
          </CardContentText>
        </div>
      )}
    </DashboardCard>
  );
};
