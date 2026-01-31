// Client-side navigation actions for TanStack Router
// These replace the Next.js server actions

export const clearLastVisitedLeague = () => {
  if (typeof window !== "undefined") {
    document.cookie = "last-visited-league=; path=/; max-age=0";
  }
};

export const resetLastVisitedLeague = ({ leagueSlug }: { leagueSlug: string }) => {
  if (typeof window !== "undefined") {
    document.cookie = `last-visited-league=${leagueSlug}; path=/; max-age=31536000`; // 1 year
  }
};

export const getLastVisitedLeague = (): string | null => {
  if (typeof window === "undefined") return null;

  const match = document.cookie.match(/last-visited-league=([^;]+)/);
  return match ? match[1] : null;
};
