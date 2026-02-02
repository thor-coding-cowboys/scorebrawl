import { trpc } from "@/lib/trpc";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/")({
  component: LeaguesIndexPage,
});

function LeaguesIndexPage() {
  const navigate = useNavigate();
  const { data: leagues, isLoading } = trpc.league.getAll.useQuery();

  useEffect(() => {
    if (!isLoading && leagues) {
      if (leagues.length > 0) {
        navigate({
          to: "/leagues/$leagueSlug",
          params: { leagueSlug: leagues[0].slug },
        });
      } else {
        navigate({ to: "/onboarding" });
      }
    }
  }, [leagues, isLoading, navigate]);

  return <div>Loading...</div>;
}
