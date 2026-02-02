import { AvatarName, AvatarNameSkeleton } from "@/components/avatar/avatar-name";
import { FormDots } from "@/components/league/player-form";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeasonPlayerStandingDTO } from "@/dto";
import { api } from "@/trpc/react";
import { Flame, Snowflake } from "lucide-react";
import type { z } from "zod";
import { CardContentText } from "./CardContentText";
import { DashboardCard } from "./DashboardCard";

export const StrugglingCard = ({
  leagueSlug,
  seasonSlug,
}: { leagueSlug: string; seasonSlug: string }) => {
  const { data, isLoading } = api.seasonPlayer.getStruggling.useQuery({ leagueSlug, seasonSlug });
  return <PlayerFormCard title={"Struggling"} player={data} isLoading={isLoading} />;
};

export const OnFireCard = ({
  leagueSlug,
  seasonSlug,
}: { leagueSlug: string; seasonSlug: string }) => {
  const { data, isLoading } = api.seasonPlayer.getOnFire.useQuery({ leagueSlug, seasonSlug });
  return <PlayerFormCard title={"On Fire"} player={data} isLoading={isLoading} />;
};

const PlayerFormCard = ({
  title,
  isLoading,
  player,
}: {
  player?: z.infer<typeof SeasonPlayerStandingDTO>;
  isLoading?: boolean;
  title: "On Fire" | "Struggling";
}) => {
  const Icon = title === "On Fire" ? Flame : Snowflake;
  return (
    <DashboardCard title={title} Icon={Icon}>
      {!player && !isLoading && <CardContentText>No Matches</CardContentText>}
      {isLoading && (
        <AvatarNameSkeleton>
          <Skeleton className={"mt-1 h-4 w-20"} />
        </AvatarNameSkeleton>
      )}
      {player && (
        <AvatarName name={player.user.name} image={player.user.image}>
          <FormDots form={player.form} />
        </AvatarName>
      )}
    </DashboardCard>
  );
};
