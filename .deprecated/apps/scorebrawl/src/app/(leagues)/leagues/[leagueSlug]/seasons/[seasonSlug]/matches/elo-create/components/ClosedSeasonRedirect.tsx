"use client";

import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const ClosedSeasonRedirect = ({ leagueSlug }: { leagueSlug: string }) => {
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    toast({
      variant: "destructive",
      title: "Season is closed",
      description: "This season is over. You cannot create new matches.",
    });
    router.replace(`/leagues/${leagueSlug}`);
  }, [toast, router, leagueSlug]);

  return null;
};
