"use client";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect } from "react";

export const ToastMessageNoOngoing = ({ leagueSlug }: { leagueSlug: string }) => {
  const [message] = useQueryState("message");
  const { push } = useRouter();

  useEffect(() => {
    if (message === "no-active") {
      toast({ title: "No active season", description: "Please create one" });
      push(`/leagues/${leagueSlug}/seasons/create`);
    }
  }, [message, leagueSlug, push]);

  return null;
};
