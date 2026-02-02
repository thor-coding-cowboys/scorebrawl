import { toast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect } from "react";
import { z } from "zod";

const indexSearchSchema = z.object({
  errorCode: z.string().optional(),
});

export const Route = createFileRoute("/")({
  component: IndexPage,
  validateSearch: zodValidator(indexSearchSchema),
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();

    // If not authenticated, redirect to sign-up
    if (!session) {
      throw redirect({ to: "/auth/sign-up" });
    }

    return { session };
  },
});

function IndexPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: leagues, isLoading, error } = trpc.league.getAll.useQuery();

  // Handle error codes from invite flow
  useEffect(() => {
    if (search.errorCode) {
      const errorMessages: Record<string, { title: string; description: string }> = {
        INVITE_NOT_FOUND: {
          title: "Invite not found",
          description: "The invite link is invalid or has been removed.",
        },
        INVITE_EXPIRED: {
          title: "Invite expired",
          description: "This invite link has expired. Please request a new one.",
        },
        INVITE_CLAIM_FAILED: {
          title: "Failed to join league",
          description: "An error occurred while joining the league. Please try again.",
        },
      };

      const error = errorMessages[search.errorCode];
      if (error) {
        toast({
          variant: "destructive",
          title: error.title,
          description: error.description,
        });
      }

      // Clear error code from URL
      navigate({ to: "/", search: {}, replace: true });
    }
  }, [search.errorCode, navigate]);

  useEffect(() => {
    if (!isLoading) {
      if (error) {
        // If there's an error fetching leagues, redirect to onboarding
        navigate({ to: "/onboarding" });
      } else if (leagues) {
        if (leagues.length > 0) {
          // Redirect to first league
          navigate({
            to: "/leagues/$leagueSlug",
            params: { leagueSlug: leagues[0].slug },
          });
        } else {
          // Redirect to onboarding
          navigate({ to: "/onboarding" });
        }
      }
    }
  }, [leagues, isLoading, error, navigate]);

  return <div>Loading...</div>;
}
