import { z } from "zod";

import { getStanding, getTopTeam } from "@scorebrawl/database/repositories/season-team-repository";
import { createTRPCRouter, seasonProcedure } from "../trpc";

export const seasonTeamRouter = createTRPCRouter({
  getStanding: seasonProcedure
    .input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
    .query(
      ({
        ctx: {
          db,
          season: { id },
        },
      }) => getStanding(db, { seasonId: id }),
    ),
  getTop: seasonProcedure
    .input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
    .query(async ({ ctx: { db }, input: { seasonSlug } }) => {
      const topTeam = await getTopTeam(db, { seasonSlug });
      if (!topTeam || topTeam.length === 0) {
        return null;
      }
      return {
        name: topTeam[0]?.name ?? "",
        players: topTeam.map((t) => ({
          id: t.id,
          name: t.name,
          image: t.image ?? undefined,
        })),
      };
    }),
});
