import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

interface Player {
  name: string;
  image?: string;
  winRatio: number;
}

interface WinRatioChartProps {
  data: Player[];
  loading: boolean;
}

export function WinRatioChart({ data, loading }: WinRatioChartProps) {
  if (loading) {
    return (
      <div className="p-4">
        <Skeleton className="w-full h-[400px]" />
      </div>
    );
  }
  if (!Array.isArray(data) || data.length === 0) {
    return <div>No data available for Win Ratio Chart</div>;
  }

  const sortedData = [...data].sort((a, b) => b.winRatio - a.winRatio);
  return (
    <div className="space-y-4 p-4 h-[400px]">
      {sortedData.map((player) => (
        <div key={player.name} className="flex items-center space-x-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={player.image} alt={player.name} />
          </Avatar>
          <div className="flex-1">
            <Progress
              value={player.winRatio * 100}
              className={cn("h-2", player.winRatio < 0.5 && "bg-rose-500/20")}
              indicatorClassName={cn(player.winRatio < 0.5 && "bg-rose-500")}
            />
          </div>
          <span className="text-sm font-medium">{(player.winRatio * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
