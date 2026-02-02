"use client";
import { DateCell } from "@/components/date-cell";
import { MultiAvatar } from "@/components/multi-avatar";
import { UpdateTeamDialog } from "@/components/players/update-team-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { api } from "@/trpc/react";
import { EditIcon } from "lucide-react";

export const LeagueTeamsTable = ({ leagueSlug }: { leagueSlug: string }) => {
  const { data } = api.leagueTeam.getAll.useQuery({ leagueSlug });
  const { data: hasEditorAccess } = api.league.hasEditorAccess.useQuery({ leagueSlug });
  const { data: session } = authClient.useSession();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map((team) => (
          <TableRow key={team.id}>
            <TableCell>
              <div className="grid gap-4 grid-cols-[auto_1fr]">
                <div className="relative">
                  <MultiAvatar
                    users={team.players.map((p) => ({
                      id: p.leaguePlayerId,
                      name: p.name,
                      image: p.image,
                    }))}
                    visibleCount={5}
                  />
                </div>
                <p className="text-sm self-center truncate">{team.name}</p>
              </div>
            </TableCell>
            <TableCell>
              <DateCell date={team.createdAt} />
            </TableCell>
            <TableCell>
              {((session && team.players.map((p) => p.userId).includes(session.user.id)) ||
                hasEditorAccess) && (
                <UpdateTeamDialog leagueSlug={leagueSlug} team={team}>
                  <EditIcon className="h-4 w-4 grow cursor-pointer text-center" />
                </UpdateTeamDialog>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
