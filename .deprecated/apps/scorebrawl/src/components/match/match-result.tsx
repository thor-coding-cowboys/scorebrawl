"use client";
import { MultiAvatarWithSkeletonLoading } from "@/components/multi-avatar";
import { Badge } from "@/components/ui/badge";
import type { MatchDTO } from "@/dto";
import { api } from "@/trpc/react";
import type { z } from "zod";

export const MatchResult = ({
  leagueSlug,
  seasonSlug,
  match: { homeScore, awayScore, homeTeamSeasonPlayerIds, awayTeamSeasonPlayerIds },
}: {
  leagueSlug: string;
  seasonSlug: string;
  match: z.infer<typeof MatchDTO>;
}) => {
  const { data: homeTeamAvatars } = api.avatar.getBySeasonPlayerIds.useQuery({
    leagueSlug,
    seasonSlug,
    seasonPlayerIds: homeTeamSeasonPlayerIds,
  });
  const { data: awayTeamAvatars } = api.avatar.getBySeasonPlayerIds.useQuery({
    leagueSlug,
    seasonSlug,
    seasonPlayerIds: awayTeamSeasonPlayerIds,
  });
  const { data: _homeTeam } = api.leagueTeam.getBySeasonPlayerIds.useQuery(
    {
      leagueSlug,
      seasonSlug,
      seasonPlayerIds: homeTeamSeasonPlayerIds,
    },
    { enabled: homeTeamSeasonPlayerIds.length > 1 },
  );
  return (
    <div className="flex items-center justify-between sm:justify-start gap-3">
      <MultiAvatarWithSkeletonLoading
        users={homeTeamAvatars?.map(({ userId, ...u }) => ({ id: userId, ...u }))}
        visibleCount={3}
      />
      <Badge className="text-base rounded font-bold whitespace-nowrap">
        {homeScore} - {awayScore}
      </Badge>
      <MultiAvatarWithSkeletonLoading
        users={awayTeamAvatars?.map(({ userId, ...u }) => ({ id: userId, ...u }))}
        visibleCount={3}
      />
    </div>
  );
};
