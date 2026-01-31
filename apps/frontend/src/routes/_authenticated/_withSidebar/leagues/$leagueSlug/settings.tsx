import { LeagueSettings } from "@/components/league/LeagueSettings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/$leagueSlug/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { leagueSlug } = Route.useParams();
  return <LeagueSettings leagueSlug={leagueSlug} />;
}
