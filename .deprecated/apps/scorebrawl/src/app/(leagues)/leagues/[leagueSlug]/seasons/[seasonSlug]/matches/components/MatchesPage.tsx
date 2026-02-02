"use client";
import { FullPageSpinner } from "@/components/full-page-spinner";
import { MatchTable } from "@/components/match/match-table";
import { Button } from "@/components/ui/button";
import { useSeason } from "@/context/season-context";
import { api } from "@/trpc/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useState } from "react";

export const MatchesPage = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const [hasLoadedFirstPage, setHasLoadedFirstPage] = useState(false);
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ throttleMs: 150 }),
  );
  const { data, isLoading } = api.match.getAll.useQuery({
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
                  onClick={async () => {
                    await setPage(page - 1);
                  }}
                  disabled={data.page <= 1}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={async () => {
                    await setPage(page + 1);
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
};
