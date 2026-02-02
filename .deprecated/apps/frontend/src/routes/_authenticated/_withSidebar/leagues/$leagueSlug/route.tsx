import { toast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect } from "react";
import { z } from "zod";

const leagueSearchSchema = z.object({
  errorCode: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/$leagueSlug")({
  component: LeagueLayout,
  validateSearch: zodValidator(leagueSearchSchema),
});

function LeagueLayout() {
  const { leagueSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const {
    data: league,
    isLoading,
    error,
  } = trpc.league.getLeagueBySlugAndRole.useQuery({ leagueSlug });

  // Handle error codes from invite flow
  useEffect(() => {
    if (search.errorCode === "INVITE_ALREADY_CLAIMED") {
      toast({
        title: "Already a member",
        description: "You're already a member of this league!",
      });

      // Clear error code from URL
      navigate({
        to: "/leagues/$leagueSlug",
        params: { leagueSlug },
        search: {},
        replace: true,
      });
    }
  }, [search.errorCode, navigate, leagueSlug]);

  if (isLoading) {
    return <div className="container py-6">Loading...</div>;
  }

  if (error || !league) {
    return <div className="container py-6">League not found</div>;
  }

  return (
    <div className="container py-6">
      <Outlet />
    </div>
  );
}
