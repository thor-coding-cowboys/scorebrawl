import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const ClosedSeasonRedirect = ({ leagueSlug }: { leagueSlug: string }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    toast({
      variant: "destructive",
      title: "Season is closed",
      description: "This season is over. You cannot create new matches.",
    });
    navigate({
      to: "/leagues/$leagueSlug",
      params: { leagueSlug },
      replace: true,
    });
  }, [toast, navigate, leagueSlug]);

  return null;
};
