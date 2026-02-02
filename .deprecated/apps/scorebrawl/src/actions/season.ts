"use server";

import { api } from "@/trpc/server";

export const findSeasonBySlug = async (leagueSlug: string, seasonSlug: string) =>
  api.season.findBySlug({ leagueSlug, seasonSlug });
