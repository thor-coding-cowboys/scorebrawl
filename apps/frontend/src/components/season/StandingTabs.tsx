import { OverviewCard } from "@/components/season/OverviewCard";
import { SeasonPlayerStanding } from "@/components/season/SeasonPlayerStanding";
import { SeasonTeamStanding } from "@/components/season/SeasonTeamStanding";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSeason } from "@/context/season-context";
import { trpc } from "@/lib/trpc";

export const StandingTabs = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const { data: season } = trpc.season.getBySlug.useQuery({ leagueSlug, seasonSlug });
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
