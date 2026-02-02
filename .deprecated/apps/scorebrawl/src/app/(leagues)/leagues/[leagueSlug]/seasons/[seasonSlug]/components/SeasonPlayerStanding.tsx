"use client";
import { Standing } from "@/components/standing/standing";
import { EmptyCardContentText } from "@/components/state/empty-card-content";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeason } from "@/context/season-context";
import { api } from "@/trpc/react";

export const SeasonPlayerStanding = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const { data, isLoading } = api.seasonPlayer.getStanding.useQuery({ leagueSlug, seasonSlug });

  if (isLoading) {
    return <Skeleton className="w-full h-80" />;
  }

  if (!data?.length) {
    return <EmptyCardContentText>No matches registered</EmptyCardContentText>;
  }

  return (
    <Standing
      items={data?.map((sp) => ({
        id: sp.seasonPlayerId,
        name: sp.user.name,
        score: sp.score,
        form: sp.form,
        matchCount: sp.matchCount,
        winCount: sp.winCount,
        drawCount: sp.drawCount,
        lossCount: sp.lossCount,
        pointDiff: sp.pointDiff,
        avatars: [{ id: sp.user.userId, image: sp.user.image, name: sp.user.name }],
        currentElo: sp.score,
        leaguePlayerId: sp.leaguePlayerId,
      }))}
      showEloRank={true}
    />
  );
};
