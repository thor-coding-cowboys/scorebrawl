"use client";

import { type ReactNode, createContext, useContext } from "react";

type SeasonContextType = {
  leagueSlug: string;
  seasonSlug: string;
};

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export const SeasonProvider = ({
  children,
  leagueSlug,
  seasonSlug,
}: SeasonContextType & { children: ReactNode }) => {
  return (
    <SeasonContext.Provider value={{ leagueSlug, seasonSlug }}>{children}</SeasonContext.Provider>
  );
};

export const useSeason = () => {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error("useLeagueSeason must be used within a LeagueSeasonProvider");
  }
  return context;
};
