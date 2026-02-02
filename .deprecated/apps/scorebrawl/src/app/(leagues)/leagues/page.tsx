import { redirectToLeagueOrOnboarding } from "@/actions/navigation-actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leagues",
};

export default async function LeagueListPage() {
  await redirectToLeagueOrOnboarding();
  return null;
}
