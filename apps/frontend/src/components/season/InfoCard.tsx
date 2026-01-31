import { CardContentText } from "@/components/season/CardContentText";
import { DashboardCard } from "@/components/season/DashboardCard";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { BarChart3 } from "lucide-react";

export const InfoCard = ({
  leagueSlug,
  seasonSlug,
}: { leagueSlug: string; seasonSlug: string }) => {
  const { data, isLoading } = trpc.season.getCountInfo.useQuery({ seasonSlug, leagueSlug });

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
