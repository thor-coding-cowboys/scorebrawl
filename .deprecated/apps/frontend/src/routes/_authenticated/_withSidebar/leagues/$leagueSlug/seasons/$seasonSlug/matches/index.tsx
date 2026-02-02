import { FullPageSpinner } from "@/components/full-page-spinner";
import { MatchTable } from "@/components/match/match-table";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

const matchesSearchSchema = z.object({
  page: z.number().int().positive().optional().default(1),
});

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/$seasonSlug/matches/",
)({
  component: MatchesPage,
  validateSearch: zodValidator(matchesSearchSchema),
});

function MatchesPage() {
  const { leagueSlug, seasonSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [hasLoadedFirstPage, setHasLoadedFirstPage] = useState(false);
  const page = search.page;

  const { data, isLoading } = trpc.match.getAll.useQuery({
    leagueSlug,
    seasonSlug,
    page,
    limit: 15,
  });

  if (!isLoading && !hasLoadedFirstPage) {
    setHasLoadedFirstPage(true);
  }

  return (
    <>
      {!hasLoadedFirstPage && isLoading && !data && <FullPageSpinner />}
      {data && data.matches.length > 0 && (
        <div className="flex flex-col flex-grow">
          <div className="flex-1 flex-grow">
            <MatchTable matches={data.matches} />
          </div>
          <div className="flex justify-end items-end">
            <div className="flex items-center">
              <div className="flex w-[100px] justify-center text-sm font-medium">
                Page {data.page} of {data.totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    navigate({
                      // @ts-ignore - TanStack Router search type inference is complex
                      search: (prev) => ({ ...prev, page: page - 1 }),
                    });
                  }}
                  disabled={data.page <= 1}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    navigate({
                      // @ts-ignore - TanStack Router search type inference is complex
                      search: (prev) => ({ ...prev, page: page + 1 }),
                    });
                  }}
                  disabled={data.totalPages <= data.page}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
