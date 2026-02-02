"use client";
import { AvatarName } from "@/components/avatar/avatar-name";
import { AvatarWithLabel } from "@/components/avatar/avatar-with-badge";
import { DateCell } from "@/components/date-cell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { getAchievementData, getTopAchievements } from "@/utils/achievement-util";
import { Medal } from "lucide-react";
import Link from "next/link";

// Updated AchievementsCell to only display top achievements
const AchievementsCell = ({
  leagueSlug,
  leaguePlayerId,
}: { leagueSlug: string; leaguePlayerId: string }) => {
  const { data } = api.achievement.getUserAchievements.useQuery({ leagueSlug, leaguePlayerId });
  if (!data || data.length === 0) {
    return null;
  }

  // Filter the achievements to only get the top one per group
  const topAchievements = getTopAchievements(data.map((achievement) => achievement.type));

  return (
    <div className="flex gap-2">
      {topAchievements.map((achievementType) => {
        const achievementData = getAchievementData(achievementType);
        return (
          <Tooltip key={achievementData.type}>
            <TooltipTrigger>
              <AvatarWithLabel
                size={"sm"}
                {...achievementData}
                fallback={<Medal className="mr-1 h-2 w-2" />}
              />
            </TooltipTrigger>

            <TooltipContent side="bottom">
              <p>{achievementData.title}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

// Type for player with optional ELO data
type PlayerWithElo = {
  leaguePlayerId: string;
  currentElo?: number | null;
} & Record<string, unknown>;

// Helper function to calculate rankings from ELO scores
const calculateRankings = (players: PlayerWithElo[]) => {
  // Filter out players without ELO scores and sort by ELO descending
  const playersWithElo = players
    .filter((p) => p.currentElo !== null && p.currentElo !== undefined)
    .sort((a, b) => (b.currentElo || 0) - (a.currentElo || 0));

  // Create ranking map
  const rankMap = new Map<string, number>();
  playersWithElo.forEach((player, index) => {
    rankMap.set(player.leaguePlayerId, index + 1);
  });

  return rankMap;
};

// Component to display ELO rank badge
const EloRankBadge = ({ rank }: { rank: number }) => {
  // Different colors/styles based on rank
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let className = "";

  if (rank === 1) {
    variant = "default";
    className = "bg-yellow-600/20 text-yellow-300 border-yellow-600/50";
  } else if (rank <= 3) {
    variant = "default";
    className = "bg-orange-600/20 text-orange-300 border-orange-600/50";
  } else if (rank <= 5) {
    variant = "default";
    className = "bg-blue-600/20 text-blue-300 border-blue-600/50";
  }

  return (
    <Badge variant={variant} className={cn("text-xs px-2 py-0.5", className)}>
      #{rank}
    </Badge>
  );
};

export const LeaguePlayersTable = ({
  leagueSlug,
}: {
  leagueSlug: string;
}) => {
  const { data } = api.leaguePlayer.getAll.useQuery({ leagueSlug });

  // Calculate rankings if ELO data is available
  const rankMap = data ? calculateRankings(data) : new Map();
  const hasEloData = data?.some((p) => "currentElo" in p && p.currentElo !== null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {hasEloData && <TableHead className="text-center">Rank</TableHead>}
          <TableHead>Joined</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Achievements</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map((player) => {
          const rank = rankMap.get(player.leaguePlayerId);
          return (
            <TableRow key={player.leaguePlayerId}>
              <TableCell>
                <Link
                  href={`/leagues/${leagueSlug}/players/${player.leaguePlayerId}`}
                  className="block hover:opacity-80 transition-opacity"
                >
                  <AvatarName name={player.user.name} image={player.user.image} />
                </Link>
              </TableCell>
              {hasEloData && (
                <TableCell className="text-center">
                  {rank ? (
                    <EloRankBadge rank={rank} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              <TableCell>
                <DateCell date={player.joinedAt} />
              </TableCell>
              <TableCell>
                <div className="flex gap-2 items-center">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      player.disabled ? "bg-rose-900" : "bg-green-400",
                    )}
                  />
                  <div>{player.disabled ? "Inactive" : "Active"}</div>
                </div>
              </TableCell>
              <TableCell>
                <AchievementsCell leagueSlug={leagueSlug} leaguePlayerId={player.leaguePlayerId} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
