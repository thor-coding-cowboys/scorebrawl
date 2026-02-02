"use client";
import { AvatarName } from "@/components/avatar/avatar-name";
import { FullPageSpinner } from "@/components/full-page-spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";
import { capitalize } from "@scorebrawl/utils/string";

export const LeagueMemberTable = ({ leagueSlug }: { leagueSlug: string }) => {
  const { data, isLoading } = api.member.getAll.useQuery({ leagueSlug });
  return (
    <Table>
      <TableHeader className="text-xs">
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={"text-sm"}>
        {isLoading && <FullPageSpinner />}
        {data?.map((member) => (
          <TableRow key={member.memberId}>
            <TableCell>
              <AvatarName textClassName="text-sm" name={member.name} image={member.image} />
            </TableCell>
            <TableCell>{capitalize(member.role)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
