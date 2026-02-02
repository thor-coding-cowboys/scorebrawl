import {
  findLeagueBySlugWithUserRole,
  getLeagueBySlugWithUserRoleOrRedirect,
} from "@/actions/league";

import type { ResolvingMetadata } from "next";
import type { ReactNode } from "react";

export const generateMetadata = async (
  { params }: { params: Promise<{ leagueSlug: string }> },
  _parent: ResolvingMetadata,
) => {
  const { leagueSlug } = await params;
  const league = { name: "" };
  try {
    const leagueBySlug = await findLeagueBySlugWithUserRole(leagueSlug);
    league.name = leagueBySlug?.name ?? "Unknown";
  } catch (_e) {
    // ignore
  }

  return {
    title: league.name,
  };
};

export default async ({
  params,
  children,
}: {
  params: Promise<{ leagueSlug: string }>;
  children: ReactNode;
}) => {
  const { leagueSlug } = await params;
  await getLeagueBySlugWithUserRoleOrRedirect(leagueSlug);
  return <>{children}</>;
};
