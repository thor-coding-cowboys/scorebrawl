import { trpc } from "@/lib/trpc";
import { type ReactNode, createContext, useContext } from "react";

type Season = {
  id: string;
  name: string;
  slug: string;
  initialScore: number;
  scoreType: "elo" | "3-1-0" | "elo-individual-vs-team";
  startDate: Date;
  endDate: Date | null;
  leagueId: string;
  closed: boolean;
};

type SeasonContextType = {
  season: Season;
  leagueSlug: string;
  seasonSlug: string;
};

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

type SeasonProviderProps = {
  children: ReactNode;
  leagueSlug: string;
  seasonSlug: string;
};

export const SeasonProvider = ({ children, leagueSlug, seasonSlug }: SeasonProviderProps) => {
  const {
    data: season,
    isLoading,
    error,
  } = trpc.season.getBySlug.useQuery({
    leagueSlug,
    seasonSlug,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading season...</div>
      </div>
    );
  }

  if (error || !season) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-destructive">{error?.message || "Season not found"}</div>
      </div>
    );
  }

  return (
    <SeasonContext.Provider value={{ season, leagueSlug, seasonSlug }}>
      {children}
    </SeasonContext.Provider>
  );
};

export const useSeason = () => {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error("useSeason must be used within a SeasonProvider");
  }
  return context;
};
