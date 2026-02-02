"use client";

import { OverviewCard } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/OverviewCard";
import { SeasonPlayerStanding } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/SeasonPlayerStanding";
import { SeasonTeamStanding } from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/SeasonTeamStanding";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSeason } from "@/context/season-context";
import { api } from "@/trpc/react";

export const StandingTabs = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const { data: season } = api.season.getBySlug.useQuery({ leagueSlug, seasonSlug });
  const showTeams = season?.scoreType !== "3-1-0";
  return (
    <OverviewCard title="Standings">
      {showTeams && (
        <Tabs defaultValue="individual">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>
          <TabsContent value="individual">
            <SeasonPlayerStanding />
          </TabsContent>
          <TabsContent value="team">
            <SeasonTeamStanding />
          </TabsContent>
        </Tabs>
      )}
      {!showTeams && <SeasonPlayerStanding />}
    </OverviewCard>
  );
};
