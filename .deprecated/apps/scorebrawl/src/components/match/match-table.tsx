"use client";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useSeason } from "@/context/season-context";
import type { MatchDTO } from "@/dto";
import { formatDistanceToNow } from "date-fns";
import type { z } from "zod";
import { MatchResult } from "./match-result";

export const MatchTable = ({
  matches,
  className,
}: {
  matches: z.infer<typeof MatchDTO>[];
  className?: string;
}) => {
  const { leagueSlug, seasonSlug } = useSeason();

  return (
    <Table className={className}>
      <TableBody>
        {matches.map((match) => (
          <TableRow key={match.id}>
            <TableCell className="hidden table-cell">
              <div className="text-s">
                {formatDistanceToNow(new Date(match.createdAt), { addSuffix: true })}
              </div>
            </TableCell>
            <TableCell>
              <div className="grid">
                <MatchResult
                  key={match.id}
                  match={match}
                  leagueSlug={leagueSlug}
                  seasonSlug={seasonSlug}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
