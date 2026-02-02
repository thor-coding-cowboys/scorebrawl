"use client";
import { resetLastVisitedLeague } from "@/actions/navigation-actions";
import { useEffect } from "react";

export const SetLastVisitedLeague = ({ leagueSlug }: { leagueSlug: string }) => {
  useEffect(() => {
    resetLastVisitedLeague({ leagueSlug });
  }, [leagueSlug]);

  return null;
};
