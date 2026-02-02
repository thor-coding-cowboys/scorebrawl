"use client";

import { resetLastVisitedLeague } from "@/actions/navigation-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSidebar } from "../ui/sidebar";

interface LeagueSwitcherProps {
  leagues: { id: string; slug: string; name: string; logoUrl: string | null }[];
  onLeagueSelect: (leagueId: string) => void;
}

export function LeagueSwitcher({ leagues, onLeagueSelect }: LeagueSwitcherProps) {
  const router = useRouter();
  const { open, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !open && !isMobile;
  // todo jonthor
  const params = useParams<{ leagueSlug: string }>();
  const [leagueSlug, setLeagueSlug] = useState(params.leagueSlug);
  useEffect(() => {
    if (params.leagueSlug) {
      setLeagueSlug(params.leagueSlug);
    }
  }, [params.leagueSlug]);

  const selectedLeague = leagues.find((league) => league.slug === leagueSlug) ?? leagues[0];
  return (
    <Select
      value={selectedLeague?.name}
      onValueChange={async (value) => {
        setOpenMobile(false);
        if (value === "create") {
          router.push("/leagues/create");
        } else {
          await resetLastVisitedLeague({ leagueSlug: value });
          onLeagueSelect(value);
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden",
        )}
        aria-label="Select League"
      >
        <SelectValue placeholder="Select a league">
          <Avatar className="h-6 w-6">
            <AvatarImage src={selectedLeague?.logoUrl ?? ""} />
            <AvatarFallback>{`${selectedLeague?.name.charAt(0).toUpperCase()}`}</AvatarFallback>
          </Avatar>
          <span className={cn("ml-1", isCollapsed && "hidden")}>{selectedLeague?.name}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-sidebar">
        <SelectGroup className="max-h-48 overflow-y-auto">
          <SelectLabel>Leagues</SelectLabel>
          {leagues.map((league) => (
            <SelectItem key={league.slug} value={league.slug}>
              <div className="flex items-center gap-2 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={league.logoUrl ?? ""} />
                  <AvatarFallback>{`${league.name.charAt(0).toUpperCase()}`}</AvatarFallback>
                </Avatar>
                {league.name}
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
        <Separator className="my-2" />
        <SelectGroup>
          <SelectItem className="mt-2 " value="create">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback>
                  <PlusIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              Create League
            </div>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
