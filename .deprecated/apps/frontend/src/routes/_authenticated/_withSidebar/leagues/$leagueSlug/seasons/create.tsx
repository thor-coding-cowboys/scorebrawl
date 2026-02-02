import { ScoreTypeSelector } from "@/components/season/score-type-selector";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const createSeasonSearchSchema = z.object({
  message: z.string().optional(),
});

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create",
)({
  component: CreateSeasonPage,
  validateSearch: zodValidator(createSeasonSearchSchema),
});

function CreateSeasonPage() {
  const { leagueSlug } = Route.useParams();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Season</h1>
      <ScoreTypeSelector leagueSlug={leagueSlug} />
    </div>
  );
}
