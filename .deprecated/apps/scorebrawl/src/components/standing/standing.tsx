"use client";
import { api } from "@/trpc/react";
import React from "react";

import { MultiAvatar } from "@/components/multi-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { useSeason } from "@/context/season-context";
import { cn } from "@/lib/utils";
import type { PlayerForm } from "@/model";
import { getRankFromElo } from "@/utils/elo-util";
import { TooltipTrigger } from "@radix-ui/react-tooltip";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormDots } from "../league/player-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { PointDiffText } from "./point-diff-text";
import { ScoreAverageChart } from "./score-average-chart";
import { WinRatioChart } from "./win-ratio-chart";

const CountText = ({ count }: { count: number }) => (
  <div className={cn(count === 0 ? "text-muted-foreground" : "")}>{count}</div>
);

// Component to display ELO tier badge
const EloTierBadge = ({ elo }: { elo: number }) => {
  const rank = getRankFromElo(elo);

  // Different colors/styles based on tier
  let className = "bg-purple-600 text-white border-purple-600";

  if (rank.name.startsWith("Grand Champion")) {
    className = "bg-purple-600 text-white border-purple-600";
  } else if (rank.name.startsWith("Champion")) {
    className = "bg-yellow-600 text-white border-yellow-600";
  } else if (rank.name.startsWith("Diamond")) {
    className = "bg-blue-600 text-white border-blue-600";
  } else if (rank.name.startsWith("Platinum")) {
    className = "bg-cyan-600 text-white border-cyan-600";
  } else if (rank.name.startsWith("Gold")) {
    className = "bg-yellow-500 text-white border-yellow-500";
  } else if (rank.name === "Rock Bottom") {
    className = "bg-gray-800 text-white border-gray-800";
  } else if (
    [
      "Casual",
      "Newbie",
      "Clueless",
      "Hopeless",
      "Disaster",
      "Burden",
      "Dead Weight",
      "Why Bother?",
    ].includes(rank.name)
  ) {
    className = "bg-red-600 text-white border-red-600";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-0.5 py-0 min-w-[16px] h-4 text-center font-bold shadow-sm border cursor-help",
            className,
          )}
        >
          {rank.short}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{rank.name}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export const Standing = ({
  items,
  enableRowClick = true,
  showEloRank = false,
}: {
  items: {
    id: string;
    name: string;
    score: number;
    matchCount: number;
    winCount: number;
    drawCount: number;
    lossCount: number;
    avatars: { id: string; name: string; image?: string }[];
    pointDiff: number | undefined;
    form: PlayerForm;
    currentElo?: number;
    leaguePlayerId?: string;
  }[];
  enableRowClick?: boolean;
  showEloRank?: boolean;
}) => {
  const { leagueSlug, seasonSlug } = useSeason();
  const router = useRouter();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const handlePlayerClick = (leaguePlayerId: string) => {
    if (showEloRank && leaguePlayerId) {
      router.push(`/leagues/${leagueSlug}/players/${leaguePlayerId}`);
    }
  };

  const handlePlayerKeyDown = (e: React.KeyboardEvent, leaguePlayerId: string) => {
    if ((e.key === "Enter" || e.key === " ") && showEloRank && leaguePlayerId) {
      e.preventDefault();
      e.stopPropagation();
      handlePlayerClick(leaguePlayerId);
    }
  };
  const sortedItems = items.sort((a, b) => {
    // Objects with matchCount=0 are moved to the end
    if (a.matchCount === 0 && b.matchCount !== 0) {
      return 1;
    }
    if (a.matchCount !== 0 && b.matchCount === 0) {
      return -1;
    }
    return b.score - a.score;
  });

  // Check if ELO data is available for tier badges
  const hasEloData =
    showEloRank && items.some((item) => item.currentElo !== null && item.currentElo !== undefined);
  const { data: playerData = [], isLoading: isLoadingPlayerData } =
    api.seasonPlayer.getTeammateStatistics.useQuery(
      { leagueSlug, seasonSlug, seasonPlayerId: selectedPlayerId ?? "" },
      { enabled: !!selectedPlayerId },
    );

  return (
    <div className="rounded-md ">
      <Table>
        <TableHeader className="text-xs">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-center">MP</TableHead>
            <TableHead className="text-center">W</TableHead>
            <TableHead className="text-center">D</TableHead>
            <TableHead className="text-center">L</TableHead>
            <TableHead className="text-center">
              <Tooltip>
                <TooltipTrigger>
                  <div>+/-</div>
                </TooltipTrigger>
                <TooltipContent>+/- points today</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className={"font-bold text-center"}>Pts</TableHead>
            <TableHead className="hidden md:table-cell text-center">Last 5</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-sm">
          {sortedItems.map(
            ({
              id,
              avatars,
              matchCount,
              name,
              score,
              form,
              pointDiff,
              winCount,
              drawCount,
              lossCount,
              leaguePlayerId,
            }) => {
              return (
                <React.Fragment key={id}>
                  <TableRow
                    onClick={
                      enableRowClick
                        ? () => setSelectedPlayerId((prev) => (prev === id ? null : id))
                        : undefined
                    }
                    className={cn(
                      "cursor-pointer h-14",
                      selectedPlayerId && selectedPlayerId !== id && "opacity-50",
                    )}
                  >
                    <TableCell className="py-2">
                      <div className="max-w-[120px] sm:max-w-none flex gap-3 items-center h-full">
                        <div
                          className={cn(
                            "relative flex-shrink-0",
                            showEloRank &&
                              leaguePlayerId &&
                              "cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded",
                          )}
                          onClick={(e) => {
                            if (showEloRank && leaguePlayerId) {
                              e.stopPropagation();
                              handlePlayerClick(leaguePlayerId);
                            }
                          }}
                          onKeyDown={(e) => handlePlayerKeyDown(e, leaguePlayerId || "")}
                          tabIndex={showEloRank && leaguePlayerId ? 0 : undefined}
                          role={showEloRank && leaguePlayerId ? "button" : undefined}
                          aria-label={
                            showEloRank && leaguePlayerId ? `View ${name}'s profile` : undefined
                          }
                        >
                          <MultiAvatar users={avatars} visibleCount={5} />
                          {hasEloData && items.find((item) => item.id === id)?.currentElo && (
                            <div className="absolute bottom-0 right-0 transform translate-x-1/3 translate-y-1/3">
                              <EloTierBadge
                                elo={items.find((item) => item.id === id)?.currentElo || 0}
                              />
                            </div>
                          )}
                        </div>
                        <div
                          className={cn(
                            "flex flex-col justify-center min-w-0 flex-1",
                            showEloRank &&
                              leaguePlayerId &&
                              "cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded",
                          )}
                          onClick={(e) => {
                            if (showEloRank && leaguePlayerId) {
                              e.stopPropagation();
                              handlePlayerClick(leaguePlayerId);
                            }
                          }}
                          onKeyDown={(e) => handlePlayerKeyDown(e, leaguePlayerId || "")}
                          tabIndex={showEloRank && leaguePlayerId ? 0 : undefined}
                          role={showEloRank && leaguePlayerId ? "button" : undefined}
                          aria-label={
                            showEloRank && leaguePlayerId ? `View ${name}'s profile` : undefined
                          }
                        >
                          <p className="font-medium truncate">{name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center p-0 sm:p-2">
                      <CountText count={matchCount} />
                    </TableCell>
                    <TableCell className="text-center p-0 sm:p-2">
                      <CountText count={winCount} />
                    </TableCell>
                    <TableCell className="text-center p-0 sm:p-2">
                      <CountText count={drawCount} />
                    </TableCell>
                    <TableCell className="text-center p-0 sm:p-2">
                      <CountText count={lossCount} />
                    </TableCell>
                    <TableCell className="text-center p-0 sm:p-2">
                      <PointDiffText diff={pointDiff} />
                    </TableCell>
                    <TableCell
                      className={`text-center p-0 sm:p-2 ${
                        matchCount > 0 ? "font-bold" : "text-muted-foreground"
                      }`}
                    >
                      {score}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className={"flex justify-center"}>
                        <FormDots form={form} />
                      </div>
                    </TableCell>
                  </TableRow>
                  {selectedPlayerId === id && matchCount > 0 && (
                    <TableRow className="w-full" key={`${id}-details`}>
                      <TableCell colSpan={8} className="w-full">
                        <Tabs defaultValue="averageTeammate">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="averageTeammate">Average Score</TabsTrigger>
                            <TabsTrigger value="winRatio">Win Ratio</TabsTrigger>
                          </TabsList>
                          <TabsContent value="winRatio">
                            <p className="text-xs text-muted-foreground">
                              Win ratio achieved with each player throughout the season.
                            </p>
                            <WinRatioChart data={playerData} loading={isLoadingPlayerData} />
                          </TabsContent>
                          <TabsContent value="averageTeammate">
                            <p className="text-xs text-muted-foreground">
                              Average Elo score achieved when playing alongside each player.
                            </p>
                            <ScoreAverageChart data={playerData} loading={isLoadingPlayerData} />
                          </TabsContent>
                        </Tabs>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            },
          )}
        </TableBody>
      </Table>
    </div>
  );
};
