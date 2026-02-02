import { trpc } from "@/lib/trpc";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/$leagueSlug/")({
  component: LeagueIndexPage,
});

function LeagueIndexPage() {
  const { leagueSlug } = Route.useParams();
  const navigate = useNavigate();

  // Fetch active season and editor access in parallel
  const { data: activeSeason, isLoading: isLoadingSeason } = trpc.season.findActive.useQuery({
    leagueSlug,
  });
  const { data: hasEditorAccess, isLoading: isLoadingAccess } =
    trpc.league.hasEditorAccess.useQuery({
      leagueSlug,
    });

  useEffect(() => {
    // Wait for both queries to complete
    if (isLoadingSeason || isLoadingAccess) {
      return;
    }

    // If no active season and user has editor access, redirect to create season
    if (!activeSeason && hasEditorAccess) {
      navigate({
        to: "/leagues/$leagueSlug/seasons/create",
        params: { leagueSlug },
        search: { message: "no-active" },
      });
    }
    // If there's an active season, redirect to it
    else if (activeSeason) {
      navigate({
        to: "/leagues/$leagueSlug/seasons/$seasonSlug",
        params: { leagueSlug, seasonSlug: activeSeason.slug },
      });
    }
    // Otherwise, redirect to seasons list
    else {
      navigate({
        to: "/leagues/$leagueSlug/seasons",
        params: { leagueSlug },
      });
    }
  }, [activeSeason, hasEditorAccess, isLoadingSeason, isLoadingAccess, navigate, leagueSlug]);

  return <div>Loading...</div>;
}
