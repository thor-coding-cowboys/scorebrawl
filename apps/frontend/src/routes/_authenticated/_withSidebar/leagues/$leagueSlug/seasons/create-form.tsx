import { SeasonCreateForm } from "@/components/season/season-create-form";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create-form",
)({
  component: CreateSeasonFormPage,
  validateSearch: (search: Record<string, unknown>) => {
    const scoreType = search.scoreType as string;

    // Validate scoreType and redirect if invalid
    if (scoreType !== "elo" && scoreType !== "3-1-0") {
      throw redirect({
        to: "/leagues/$leagueSlug/seasons/create",
        params: (params) => ({ leagueSlug: params.leagueSlug ?? "" }),
      });
    }

    return {
      scoreType: scoreType as "elo" | "3-1-0",
    };
  },
});

function CreateSeasonFormPage() {
  const { leagueSlug } = Route.useParams();
  const { scoreType } = Route.useSearch();

  return (
    <div className="max-w-2xl mx-auto">
      <SeasonCreateForm leagueSlug={leagueSlug} scoreType={scoreType} />
    </div>
  );
}
