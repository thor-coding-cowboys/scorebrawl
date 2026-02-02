"use client";
import { DashboardCard } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/DashboardCard";
import {
  OnFireCard,
  StrugglingCard,
} from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/PlayerFormCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeason } from "@/context/season-context";
import { api } from "@/trpc/react";
import { Loader } from "lucide-react";
import { InfoCard } from "./InfoCard";
import { LatestMatchCard } from "./LatestMatchCard";
import { YourNextMatchCard } from "./YourNextMatchCard";

const LoadingCard = () => {
  return (
    <DashboardCard Icon={Loader} title="...">
      <Skeleton className={"gap-2 h-4 w-full"} />
    </DashboardCard>
  );
};

export const DashboardCards = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const { data: isInSeason, isLoading } = api.seasonPlayer.isInSeason.useQuery({
    leagueSlug,
    seasonSlug,
  });
  const { data: season, isLoading: isLoadingSeason } = api.season.getBySlug.useQuery({
    leagueSlug,
    seasonSlug,
  });
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 w-full">
      <OnFireCard leagueSlug={leagueSlug} seasonSlug={seasonSlug} />
      <StrugglingCard leagueSlug={leagueSlug} seasonSlug={seasonSlug} />
      {isLoading || isLoadingSeason ? (
        <LoadingCard />
      ) : isInSeason && season?.scoreType === "3-1-0" ? (
        <YourNextMatchCard />
      ) : (
        <InfoCard leagueSlug={leagueSlug} seasonSlug={seasonSlug} />
      )}
      <LatestMatchCard leagueSlug={leagueSlug} seasonSlug={seasonSlug} />
    </div>
  );
};
